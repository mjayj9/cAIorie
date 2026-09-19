import {spawnSync} from "node:child_process";
import {readdirSync} from "node:fs";
const files=readdirSync("tests").filter(n=>n.endsWith(".test.ts")).map(n=>"tests/"+n);
const r=spawnSync(process.execPath,["--experimental-transform-types","--test",...files],{stdio:"inherit"});
process.exit(r.status??1);
