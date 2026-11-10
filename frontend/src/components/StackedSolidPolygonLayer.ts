import {
  SolidPolygonLayer,
  type SolidPolygonLayerProps,
} from "@deck.gl/layers";
import type { Accessor, DefaultProps } from "@deck.gl/core";

export interface StackedSolidPolygonLayerProps<DataT = unknown>
  extends SolidPolygonLayerProps<DataT> {
  /**
   * Dilimin taban yüksekliği (z-offset, metre).
   * Hover durumunda havaya kalkma (lift) yüksekliği.
   */
  getBaseElevation?: Accessor<DataT, number>;
  /**
   * Dilimin güney-kuzey (aşağıdan yukarıya) enlem aralığı [minLat, maxLat].
   * İlin gerçek yüzey alanına göre hesaplanan yatay şerit sınırlarıdır.
   */
  getBandLatBounds?: Accessor<DataT, [number, number]>;
}

const defaultProps: DefaultProps<StackedSolidPolygonLayerProps> = {
  getBaseElevation: { type: "accessor", value: 0 },
  getBandLatBounds: { type: "accessor", value: [-90, 90] },
};

/**
 * SolidPolygonLayer alt sınıfı:
 * Her il × kaynak diliminin 2B poligon geometrisini yalnızca BİR KEZ üçgenler (earcut),
 * il bloğunun yüksekliğini (getElevation), hover kalkışını (getBaseElevation) ve
 * güneyden kuzeye alan-oranlı yatay şerit sınırlarını (getBandLatBounds)
 * doğrudan GPU özniteliği (attribute) olarak taşır ve GPU üzerinde yumuşak geçiş (transition) yapar.
 */
export class StackedSolidPolygonLayer<
  DataT = unknown,
  ExtraProps extends Record<string, unknown> = Record<string, unknown>,
> extends SolidPolygonLayer<
  DataT,
  ExtraProps & Required<StackedSolidPolygonLayerProps<DataT>>
> {
  static layerName = "StackedSolidPolygonLayer";
  static defaultProps = defaultProps;

  initializeState(): void {
    super.initializeState();
    const attributeManager = this.getAttributeManager();
    if (attributeManager) {
      attributeManager.add({
        baseElevations: {
          size: 1,
          stepMode: "dynamic",
          transition: true,
          accessor: "getBaseElevation",
          defaultValue: 0,
          bufferGroup: "solid-polygon-instance-data",
        },
        bandLatBounds: {
          size: 2,
          stepMode: "dynamic",
          transition: true,
          accessor: "getBandLatBounds",
          defaultValue: [-90, 90],
          bufferGroup: "solid-polygon-instance-data",
        },
      });
    }
  }

  getShaders(type: "top" | "side"): ReturnType<SolidPolygonLayer["getShaders"]> {
    const shaders = super.getShaders(type);
    if (typeof shaders.vs !== "string" || typeof shaders.fs !== "string") {
      return shaders;
    }

    let vs = shaders.vs
      .replace(
        "in float elevations;",
        "in float elevations;\nin float baseElevations;\nin vec2 bandLatBounds;\nout float vWorldLat;\nout vec2 vBandLatBounds;"
      )
      .replace(
        "vec3 pos = props.positions;\nvec3 pos64Low = props.positions64Low;",
        `vWorldLat = props.positions.y;
vBandLatBounds = bandLatBounds;
if (bandLatBounds.y - bandLatBounds.x <= 1e-6) {
  gl_Position = vec4(0.0);
  return;
}
vec3 pos = props.positions;
vec3 pos64Low = props.positions64Low;`
      );

    if (type === "top") {
      vs = vs.replace(
        "props.elevations = elevations;",
        `if (solidPolygon.extruded && elevations <= 0.5) { gl_Position = vec4(0.0); return; }
props.elevations = baseElevations + elevations;`
      );
    } else {
      vs = vs.replace(
        "props.elevations = elevations * positions.y;",
        `if (solidPolygon.extruded && elevations <= 0.5) { gl_Position = vec4(0.0); return; }
props.elevations = baseElevations + elevations * positions.y;`
      );
    }

    const fs = shaders.fs
      .replace(
        "in vec4 vColor;",
        "in vec4 vColor;\nin float vWorldLat;\nin vec2 vBandLatBounds;"
      )
      .replace(
        "fragColor = vColor;",
        `if (vBandLatBounds.y - vBandLatBounds.x <= 1e-6 || vWorldLat < vBandLatBounds.x || vWorldLat > vBandLatBounds.y) {
  discard;
}
fragColor = vColor;
float bandEdgeDist = min(vWorldLat - vBandLatBounds.x, vBandLatBounds.y - vWorldLat);
float latFw = max(fwidth(vWorldLat), 1e-5);
if (bandEdgeDist < latFw * 0.65) {
  fragColor.rgb *= 0.78;
}`
      );

    return {
      ...shaders,
      vs,
      fs,
    };
  }
}
