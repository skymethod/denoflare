import { Transform, TransformParameter, TransformParameterType } from './transforms.ts';

export async function computeTransforms(): Promise<Transform[]> {
    const photon = await import('./ext/photon_rs_bg.js');
    const transforms: Transform[] = [];
    for (const [ name, value ] of Object.entries(photon)) {
        if (typeof value === 'function' && /^[a-z]/.test(name)) {
            if ([
                'base64_to_image', 
                'base64_to_vec', 
                'create_gradient', 
                'crop_img_browser', 
                'get_image_data', 
                'open_image', 
                'putImageData', 
                'resize', 
                'resize_img_browser', 
                'run', 'setWasm', 
                'solarize_retimg',
                'to_image_data',
                'to_raw_pixels',
            ].includes(name)) continue;
            const str = value.toString();
            // console.log(str);
            // function adjust_contrast(photon_image, contrast) {
            const m = /^function [a-z0-9A-Z_]+\(([a-z0-9_]+(, [a-z0-9_]+)*)?\)/.exec(str);
            // console.log(name, m);
            if (!m) throw new Error(`Failed to match function header: ${str}`);
            const params = m[1] ? m[1].split(',').map(v => v.trim()) : [];
            // console.log(params);

            let returns: string | undefined;
            const m2 = /return\s+([^\s]+);\s*}\s*(finally\s*{.*?}\s*}\s*)?$/s.exec(str);
            if (m2) {
                // console.log(m2);
                returns = m2[1];
            } else {
                if (str.includes('return ')) throw new Error(`Failed to match return: ${str}`);
            }

            if (params.length === 0) throw new Error();
            const p1 = params[0];
            if (p1 !== 'photon_image' && p1 !== 'img' && p1 !== 'image') throw new Error(`p1: ${p1}`);

            if (params.length === 1) {
                if (returns) throw new Error();
                transforms.push({ name, parameters: [] });
                continue;
            }
            if (params.length === 2) {
                if (returns) throw new Error();

                const p2 = params[1];
                const param: TransformParameter = { name: p2, type: computeTransformParameterType(p2) };
                transforms.push({ name, parameters: [ param ] });
                continue;
            }
            // console.log(`${name}(${params.join(', ')})${returns ? ` -> ${returns}` : ''}`);
        }
    }
    return transforms;
}

//

function computeTransformParameterType(name: string): TransformParameterType {
    if (name === 'contrast') {
        // adjust_contrast: 
        // `contrast` - An f32 factor used to adjust contrast. Between [-255.0, 255.0]. The algorithm will clamp results if passed factor is out of range.
        return { kind: 'float', min: -255, max: 255, default: 100 };
    } else if (name === 'amt') {
        // alter_(blue|green|red)_channel
        // `amt` - The amount to increment or decrement the channel's value by for that pixel.
        // 10_i16
        // -32768 to 32767
        // throws if too large
        return { kind: 'int', min: -255, max: 255, default: 100 };
    } else if (name === 'level') {
        // darken_(hsl|hsv|lch)
        // desaturate_(hsl|hsv|lch)
        // lighten_(hsl|hsv|lch)
        // saturate_(hsl|hsv|lch)
        // Float value from 0 to 1 representing the level to which to darken the image by.
        // The `level` must be from 0 to 1 in floating-point, `f32` format.
        // Darkening by 80% would be represented by a `level` of 0.8
        return { kind: 'float', min: 0, max: 1, default: 0.2 };
    } else if (name === 'filter_name') {
        // filter
        // 16 filter names
        return { kind: 'enum', values: [
            'oceanic',
            'islands',
            'marine',
            'seagreen',
            'flagblue',
            'liquid',
            'diamante',
            'radio',
            'twenties',
            'rosetint',
            'mauve',
            'bluechrome',
            'vintage',
            'perfume',
            'serenity',
        ] };
    } else if (name === 'radius') {
        // gaussian_blur
        // blur radius
        // e.g. 3_i32
        // crashes if too large
        return { kind: 'int', min: -150, max: 150, default: 2 };
    } else if (name === 'num_shades') {
        // grayscale_shades
        // The number of grayscale shades to be displayed in the image.
        // For example, to limit an image to four shades of gray only:
        // 4_u8
        // 0 to 255
        // 0,1 doesn't make sense

        return { kind: 'int', min: 2, max: 255, default: 2 };
    } else if (name === 'num_strips') {
        // (horizontal|vertical)_strips
        // Horizontal strips. Divide an image into a series of equal-height strips, for an artistic effect.
        // e.g. 8u8
        // 128 is perceptual max
        return { kind: 'int', min: 0, max: 128, default: 8 };
    } else if (name === 'degrees') {
        // hue_rotate_(hsl|hsv|lch)
        // For example to hue rotate/shift the hue by 120 degrees in the HSL colour space:
        // 120_f32
        // THIS IS WRONG
        // actually float 0 to 1 (pct)
        return { kind: 'float', min: 0, max: 1, default: 0.2 };
    } else if (name === 'brightness') {
        // inc_brightness
        // A u8 to add to the brightness.
        // 10_u8
        return { kind: 'int', min: 0, max: 255, default: 32 };
    } else if (name === 'offset_amt') {
        // offset_(blue|green|red)
        // Adds an offset to the blue channel by a certain number of pixels.
        // The offset you want to move the (blue|green|red) channel by.
        // 40_u32
        // 0 to 4294967295
        return { kind: 'int', min: 0, max: 255, default: 10 };
    } else if (name === 'min_filter') {
        // remove_(blue|green|red)_channel
        // Remove the Red channel's influence in an image.
        // Only remove the channel if the current pixel's channel value is less than this minimum filter.
        // For example, to remove the red channel for red channel pixel values less than 50:
        // 50_u8
        return { kind: 'int', min: 0, max: 255, default: 100 };
    } else if (name === 'ref_color') {
        // selective_greyscale
        // For example, to greyscale all pixels that are *not* visually similar to the RGB colour RGB{20, 40, 60}:
        // Rgb::new(20_u8, 40_u8, 60_u8)
        return { kind: 'rgb' };
    } else if (name === 'channel') {
        // single_channel_grayscale
        // Convert an image to grayscale by setting a pixel's 3 RGB values to a chosen channel's value.
        // A usize representing the channel from 0 to 2. O represents the Red channel, 1 the Green channel, and 2 the Blue channel.
        // To grayscale using only values from the Red channel:
        // 0_usize
        return { kind: 'channel' };
    } else if (name === 'threshold') {
        // threshold
        // The amount the image should be thresholded by from 0 to 255.
        // 30_u32
        return { kind: 'int', min: 0, max: 255, default: 60 };
    } else {
        throw new Error();
    }
}
