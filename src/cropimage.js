const Jimp = require('jimp');

async function cropImage_(image, x, y, w, h)
{
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);

    const imageBitmapData = image.bitmap.data;
    const imageDataLength = imageBitmapData.length;

    const imageWidth = image.bitmap.width;
    const imageRowBytes = imageWidth*4;
    const imageHeight = image.bitmap.height;

    const croppedRowBytes = 4*w;
    //const croppedBitmapData = Buffer.allocUnsafe(h*croppedRowBytes);
    const zeroValue = 0x80;
    const croppedBitmapData = Buffer.alloc(h*croppedRowBytes, zeroValue);

    if ((x + w) <= 0 || x >= imageWidth
     || (y + h) <= 0 || y >= imageHeight) {
        croppedBitmapData.fill(zeroValue, 0, h*croppedRowBytes);
    } else {
        let imageStartRow = y;
        let imageEndRow = imageStartRow + h;
        let cropStartRow = 0;
        let cropEndRow = h;

        if (imageStartRow < 0) {
            croppedBitmapData.fill(zeroValue, 0, -imageStartRow*croppedRowBytes);
            cropStartRow = -imageStartRow;
            imageStartRow = 0;
        }


/*
---
Im
Im   ----
---

     ----
*/
        if (imageEndRow > imageHeight) {
            croppedBitmapData.fill(zeroValue, (imageHeight - y)*croppedRowBytes, h*croppedRowBytes);
            cropEndRow -= (imageEndRow - imageHeight);
            imageEndRow = imageHeight;
        }

        if (x === 0 && w === imageWidth) {
            imageBitmapData.copy(croppedBitmapData, cropStartRow*w, imageStartRow*imageRowBytes, imageEndRow*imageRowBytes);
        } else {
/*
            |_____xxx|    bb + d = w          x = 0, d bytes into bb
            |xxx_____|    d + bb = w          x = x, d bytes into 0
            |xxxxxxxx|    bb = 0, d = w       x = x, b bytes into 0
*/
            let blankRow = null;
            let blankBytes = 0;
            let blankOffset = 0;
            let croppedOffset = 0;
            let imageRowOffset = 0;
            if (x < 0) {
                blankBytes = -x*4;
                croppedOffset = blankBytes;
                x = 0;
            } else if ((x + w) > imageWidth) {
                blankBytes = (x + w - imageWidth)*4;
                blankOffset = croppedRowBytes - blankBytes;
            }
            if (blankBytes) {
                blankRow = Buffer.alloc(blankBytes, zeroValue);
            }

            blankOffset += (cropStartRow*croppedRowBytes);
            croppedOffset += (cropStartRow*croppedRowBytes);
            imageRowOffset += (imageStartRow*imageRowBytes + x*4);
            let imageRowEnd = imageRowOffset + (croppedRowBytes - blankBytes);

//console.log(cropStartRow, blankOffset, croppedOffset, imageRowOffset);

            while (cropStartRow < cropEndRow) {
                if (blankBytes) {
                    blankRow.copy(croppedBitmapData, blankOffset);
                }
                imageBitmapData.copy(croppedBitmapData, croppedOffset, imageRowOffset, imageRowEnd);
                blankOffset += croppedRowBytes;
                croppedOffset += croppedRowBytes;
                imageRowOffset += imageRowBytes;
                imageRowEnd += imageRowBytes;
                cropStartRow += 1;
            }
        }
    }

    const croppedImage = await new Jimp({ data: croppedBitmapData, width: w, height: h });
    return croppedImage;
}


async function testCrop(image, x, y , w, h, output)
{
    const img = await cropImage_(image, x, y, w, h);
    img.write(output);
}

async function main(imageFile)
{
    const image = await new Jimp.read(`${imageFile}.png`);

    console.log(image);

    await testCrop(image, 0, 0, 345, 385, `${imageFile}-0.png`);
    await testCrop(image, 0, 0, 345, 190, `${imageFile}-1.png`);
    await testCrop(image, 0, 190, 345, 195, `${imageFile}-2.png`);
    await testCrop(image, 0, 0, 170, 385, `${imageFile}-3.png`);
    await testCrop(image, 170, 0, 175, 385, `${imageFile}-4.png`);
    await testCrop(image, -100, 100, 70, 70, `${imageFile}-5.png`);
    await testCrop(image, -100, 100, 70, 370, `${imageFile}-6.png`);
    await testCrop(image, -10, -10, 110, 110, `${imageFile}-7.png`);
    await testCrop(image, 300, -100, 100, 270, `${imageFile}-8.png`);
    await testCrop(image, 150, 150, 70, 70, `${imageFile}-9.png`);
    await testCrop(image, 60, 350, 70, 70, `${imageFile}-10.png`);
    await testCrop(image, 60, 400, 70, 70, `${imageFile}-11.png`);
}


main('test-image');  // 345 x 385
