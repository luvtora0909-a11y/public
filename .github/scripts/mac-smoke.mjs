import { _electron as electron } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

if(process.platform!=='darwin')throw new Error('This check requires macOS');
const arm=process.arch==='arm64';
const version=JSON.parse(await fs.readFile('package.json','utf8')).version;
const zipName=`Luvtora Operations-${version}-${arm?'arm64-mac':'mac'}.zip`;
const extractDir=await fs.mkdtemp(path.join(os.tmpdir(),'luvtora-mac-extract-'));
execFileSync('ditto',['-x','-k',path.resolve('dist',zipName),extractDir]);
const appPath=path.join(extractDir,'Luvtora Operations.app');
execFileSync('codesign',['--verify','--deep','--strict','--verbose=2',appPath],{stdio:'inherit'});
const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'luvtora-mac-smoke-'));
const processArgs=['--user-data-dir='+dataDir];
let app;
try {
  app=await electron.launch({executablePath:path.join(appPath,'Contents/MacOS/Luvtora Operations'),args:processArgs,timeout:45000});
  const page=await app.firstWindow();
  await page.getByRole('heading',{name:'经营总览',exact:true}).waitFor({timeout:30000});
  await page.locator('nav').getByRole('button',{name:'运营任务'}).click();
  await page.getByRole('heading',{name:'运营任务',exact:true}).waitFor();
  const vaultPassed=await app.evaluate(({safeStorage})=>safeStorage.isEncryptionAvailable()&&safeStorage.decryptString(safeStorage.encryptString('Luvtora CI test'))==='Luvtora CI test');
  if(!vaultPassed)throw new Error('macOS safeStorage encryption round-trip failed');
  await page.screenshot({path:'dist/mac-runtime-check.png'});
  console.log('ZIP extracted, code signature verified, application launched, task page rendered, macOS safeStorage round-trip passed.');
} catch(error) {
  console.log('::error title=Mac runtime validation::'+String(error.message).slice(0,4000).replaceAll('%','%25').replaceAll('\n','%0A').replaceAll('\r','%0D'));
  throw error;
} finally {
  await app?.close();
  await fs.rm(dataDir,{recursive:true,force:true});
  await fs.rm(extractDir,{recursive:true,force:true});
}
