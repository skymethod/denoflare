import { Theme } from './theme.ts';
import { importBinary } from './deps_worker.ts';

export const FAVICON_SVG = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="100%" height="100%" viewBox="0 0 1400 1400" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
  <style>@media (prefers-color-scheme:dark) { path { fill: ${Theme.primaryColor300Hex}; } }</style>
  <path fill="${Theme.primaryColor900Hex}" d="M700,106.295C1027.67,106.295 1293.7,372.325 1293.7,700C1293.7,1027.67 1027.67,1293.7 700,1293.7C372.325,1293.7 106.295,1027.67 106.295,700C106.295,372.325 372.325,106.295 700,106.295ZM619.971,667.529L650.488,510.059L722.021,510.059L648.047,889.941L577.002,889.941L584.57,849.414C573.828,865.039 561.743,876.88 548.315,884.937C534.888,892.993 520.443,897.021 504.98,897.021C481.217,897.021 462.378,888.07 448.462,870.166C434.546,852.262 427.588,827.848 427.588,796.924C427.588,775.928 430.111,754.972 435.156,734.058C440.202,713.143 447.282,693.978 456.396,676.563C467.627,655.566 481.787,639.128 498.877,627.246C515.967,615.365 534.033,609.424 553.076,609.424C571.305,609.424 586.401,614.591 598.364,624.927C610.327,635.262 617.529,649.463 619.971,667.529ZM896.484,597.949L892.578,616.504L976.563,616.504L966.064,671.436L882.08,671.436L839.6,889.941L768.066,889.941L810.547,671.436L743.896,671.436L754.395,616.504L821.045,616.504L824.951,597.461C831.787,563.118 842.692,539.966 857.666,528.003C872.64,516.04 899.577,510.059 938.477,510.059L997.07,510.059L986.572,564.99L930.42,564.99C919.84,564.99 912.191,567.228 907.471,571.704C902.751,576.18 899.089,584.928 896.484,597.949ZM566.016,668.018C547.949,668.018 532.406,679.533 519.385,702.563C506.364,725.594 499.854,753.548 499.854,786.426C499.854,802.865 503.231,815.641 509.985,824.756C516.74,833.87 526.058,838.428 537.939,838.428C556.494,838.428 572.567,827.157 586.157,804.614C599.748,782.072 606.543,754.688 606.543,722.461C606.543,705.534 602.881,692.228 595.557,682.544C588.232,672.86 578.385,668.018 566.016,668.018Z" />
</svg>`;

export const FAVICON_VERSION = '2';

export const FAVICON_ICO = await importBinary(import.meta.url, './favicon.ico');