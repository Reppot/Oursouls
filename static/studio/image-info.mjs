export async function validatePrintFile(file){
 if(file.size>20*1024*1024)throw new Error('Выбери PNG или JPEG до 20 МБ.');
 const v=new DataView(await file.slice(0,1024*1024).arrayBuffer());let width=0,height=0;
 if(v.byteLength>=24&&v.getUint32(0)===0x89504e47&&v.getUint32(4)===0x0d0a1a0a){width=v.getUint32(16);height=v.getUint32(20)}
 else if(v.byteLength>4&&v.getUint16(0)===0xffd8){
  let at=2;
  while(at+4<v.byteLength){if(v.getUint8(at++)!==255)break;let marker=v.getUint8(at++);while(marker===255&&at<v.byteLength)marker=v.getUint8(at++);if(marker===0xd9||marker===0xda)break;const length=v.getUint16(at);if(length<2||at+length>v.byteLength)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=7){height=v.getUint16(at+3);width=v.getUint16(at+5);break}at+=length;
  }
 }
 if(!width||!height)throw new Error('Не удалось прочитать PNG/JPEG. Пересохрани изображение и попробуй снова.');
 if(width*height>40_000_000)throw new Error('Выбери изображение до 40 мегапикселей.');
 return {width,height};
}
