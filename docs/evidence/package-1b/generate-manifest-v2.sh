#!/bin/sh
set -eu
export LC_ALL=C

db_path=${1:?usage: generate-manifest-v2.sh /absolute/path/to/foundry.sqlite}

test -f "$db_path"
test ! -e "${db_path}-wal"
test ! -e "${db_path}-shm"

db_uri="file:${db_path}?mode=ro&immutable=1"

E() {
  printf "case when %s is null then 'N' else 'V'||hex(cast(%s as blob)) end" "$1" "$1"
}

SC="select 'S|'||$(E type)||'|'||$(E name)||'|'||$(E tbl_name)||'|'||$(E sql)
from sqlite_master
where name not like 'sqlite_autoindex%'
order by type collate binary, name collate binary;"

SQ="select 'Q|'||$(E name)||'|'||$(E seq)
from sqlite_sequence
order by name collate binary;"

EV="select 'E|'||$(E sequence)||'|'||$(E id)||'|'||$(E type)||'|'||
$(E occurred_at)||'|'||$(E actor_type)||'|'||$(E actor_id)||'|'||
$(E entity_type)||'|'||$(E entity_id)||'|'||$(E correlation_id)||'|'||
$(E causation_id)||'|'||$(E severity)||'|'||$(E schema_version)||'|'||
$(E payload)
from events
order by sequence asc;"

EN="select 'N|'||$(E entity_type)||'|'||$(E entity_id)||'|'||
$(E data)||'|'||$(E updated_at)
from entities
order by entity_type collate binary, entity_id collate binary;"

{
  printf '%s\n' 'FOUNDRY-LOGICAL-MANIFEST-v2'

  sqlite3 -batch -noheader "$db_uri" \
    "select 'M|encoding|'||
     case when encoding is null then 'N'
          else 'V'||hex(cast(encoding as blob)) end
     from pragma_encoding;"

  sqlite3 -batch -noheader "$db_uri" \
    "select 'M|user_version|'||
     case when user_version is null then 'N'
          else 'V'||hex(cast(user_version as blob)) end
     from pragma_user_version;"

  sqlite3 -batch -noheader "$db_uri" "$SC"
  sqlite3 -batch -noheader "$db_uri" "$SQ"
  sqlite3 -batch -noheader "$db_uri" "$EV"
  sqlite3 -batch -noheader "$db_uri" "$EN"
}
