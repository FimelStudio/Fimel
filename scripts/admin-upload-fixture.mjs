import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { once } from 'node:events';
import { crc32 } from 'node:zlib';
await mkdir('.artifacts/admin-fixtures',{recursive:true});
const filename=Buffer.from('payload.bin');const size=100*1024**2;
const stream=createWriteStream('.artifacts/admin-fixtures/100-mib.zip');
const write=async(bytes)=>{if(!stream.write(bytes))await once(stream,'drain');};
const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,6);local.writeUInt16LE(33,12);local.writeUInt16LE(filename.length,26);await write(local);await write(filename);
const chunk=Buffer.alloc(1024**2);let crc=0;
for(let n=0;n<100;n++){crc=crc32(chunk,crc);await write(chunk);}
const descriptor=Buffer.alloc(16);descriptor.writeUInt32LE(0x08074b50,0);descriptor.writeUInt32LE(crc,4);descriptor.writeUInt32LE(size,8);descriptor.writeUInt32LE(size,12);await write(descriptor);
const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,8);central.writeUInt16LE(33,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(size,20);central.writeUInt32LE(size,24);central.writeUInt16LE(filename.length,28);await write(central);await write(filename);
const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+filename.length,12);end.writeUInt32LE(local.length+filename.length+size+descriptor.length,16);await write(end);stream.end();await once(stream,'finish');console.log('Created real ZIP fixture with 100 MiB stored payload in .artifacts/admin-fixtures/100-mib.zip');
