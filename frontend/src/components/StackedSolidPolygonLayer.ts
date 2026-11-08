import {
  SolidPolygonLayer,
  type SolidPolygonLayerProps,
} from "@deck.gl/layers";
import type { Accessor, DefaultProps } from "@deck.gl/core";

export interface StackedSolidPolygonLayerProps<DataT = unknown>
  extends SolidPolygonLayerProps<DataT> {
  /**
   * Dilimin taban yüksekliği (z-offset, metre).
   * Altındaki dilimlerin yükseklik toplamı + hover durumunda havaya kalkma (lift) yüksekliği.
   */
  getBaseElevation?: Accessor<DataT, number>;
  /**
   * Poligon parçasının [lon, lat] ağırlık merkezi.
   * Üst dilimlerin teraslı (stepped) olarak merkeze doğru ölçeklenmesi için kullanılır.
   */
  getCentroid?: Accessor<DataT, [number, number]>;
  /**
   * Dilimin yatay ölçek oranı (0..1).
   * En alttaki en büyük dilim = 1.0 (ilin tam sınırı); üstteki dilimler kalan payın karekökü
   * oranında kademeli küçülerek 50° kamera açısında her dilimin hem yandan hem üstten
   * gerçek payıyla okunmasını sağlar.
   */
  getScaleRatio?: Accessor<DataT, number>;
}

const defaultProps: DefaultProps<StackedSolidPolygonLayerProps> = {
  getBaseElevation: { type: "accessor", value: 0 },
  getCentroid: { type: "accessor", value: [0, 0] },
  getScaleRatio: { type: "accessor", value: 1 },
};

/**
 * SolidPolygonLayer alt sınıfı:
 * Her il × kaynak diliminin 2B poligon geometrisini yalnızca BİR KEZ üçgenler (earcut),
 * dilimin taban yüksekliğini (getBaseElevation), dilim kalınlığını (getElevation) ve
 * teras ölçeğini (getScaleRatio) doğrudan GPU özniteliği (attribute) olarak taşır ve
 * GPU üzerinde yumuşak geçiş (transition) yapar.
 * Sıfır yüksekliğe inen dilimler vertex shader'da elenerek Z-fighting önlenir.
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
        centroids: {
          size: 2,
          stepMode: "dynamic",
          accessor: "getCentroid",
          defaultValue: [0, 0],
          bufferGroup: "solid-polygon-instance-data",
        },
        scaleRatios: {
          size: 1,
          stepMode: "dynamic",
          transition: true,
          accessor: "getScaleRatio",
          defaultValue: 1,
          bufferGroup: "solid-polygon-instance-data",
        },
      });
    }
  }

  getShaders(type: "top" | "side"): ReturnType<SolidPolygonLayer["getShaders"]> {
    const shaders = super.getShaders(type);
    if (typeof shaders.vs !== "string") {
      return shaders;
    }

    let vs = shaders.vs
      .replace(
        "in float elevations;",
        "in float elevations;\nin float baseElevations;\nin vec2 centroids;\nin float scaleRatios;"
      )
      .replace(
        "vec3 pos = props.positions;\nvec3 pos64Low = props.positions64Low;",
        `vec3 pos = props.positions;
pos.xy = centroids + (pos.xy - centroids) * scaleRatios;
vec3 pos64Low = props.positions64Low * vec3(scaleRatios, scaleRatios, 1.0);`
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

    return {
      ...shaders,
      vs,
    };
  }
}
