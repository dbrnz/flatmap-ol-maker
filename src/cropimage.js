/******************************************************************************

Flatmap viewer and annotation tool

Copyright (c) 2019  David Brooks

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

******************************************************************************/

'use strict';

//==============================================================================

const Jimp = require('jimp');

//==============================================================================

async function cropImage(image, x, y, w, h)
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
    const croppedBitmapData = Buffer.allocUnsafe(h*croppedRowBytes);

    if ((x + w) <= 0 || x >= imageWidth
     || (y + h) <= 0 || y >= imageHeight) {
        croppedBitmapData.fill(0, 0, h*croppedRowBytes);
    } else {
        let imageStartRow = y;
        let imageEndRow = imageStartRow + h;
        let cropStartRow = 0;
        let cropEndRow = h;

        if (imageStartRow < 0) {
            croppedBitmapData.fill(0, 0, -imageStartRow*croppedRowBytes);
            cropStartRow = -imageStartRow;
            imageStartRow = 0;
        }

        if (imageEndRow > imageHeight) {
            croppedBitmapData.fill(0, (imageHeight - y)*croppedRowBytes, h*croppedRowBytes);
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
                blankRow = Buffer.alloc(blankBytes, 0);
            }

            blankOffset += (cropStartRow*croppedRowBytes);
            croppedOffset += (cropStartRow*croppedRowBytes);
            imageRowOffset += (imageStartRow*imageRowBytes + x*4);
            let imageRowEnd = imageRowOffset + (croppedRowBytes - blankBytes);
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

//==============================================================================

module.exports.cropImage = cropImage;

//==============================================================================
