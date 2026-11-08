-- mart_live_snapshot tam olarak bir satır olmalı. Dönen satır: gerçek satır sayısı.
select count(*) as row_count
from {{ ref('mart_live_snapshot') }}
having count(*) != 1
