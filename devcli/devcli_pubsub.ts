export async function generateReasonCodes(_args: (string | number)[], _options: Record<string, unknown>): Promise<void> {
    // await generateReasonCodesForType('Disconnect Reason Code values');
    // await generateReasonCodesForType('Connect Reason Code values');
    await generateReasonCodesForType('Subscribe Reason Codes');
}

//

async function generateReasonCodesForType(type: string) {
    const despan = (v: string) => {
        const m = />(.*?)</s.exec(v);
        return m ? m[1] : v;
    };
    const fixWhitespace = (v: string) => v.replaceAll(/\s+/gs, ' ').trim();
    const res = await fetch('https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html');
    const text = await res.text();
    let m = new RegExp(type + '</p>\\s+(<table.*?</table>)', 'si').exec(text);
    if (m) {
        const table = m[1];
        const pattern = /<tr.*?<p class=MsoNormal>(.*?)<\/p>.*?<p class=MsoNormal>(.*?)<\/p>.*?<p class=MsoNormal>(.*?)<\/p>.*?<p class=MsoNormal>(.*?)<\/p>.*?<\/tr>/gs;
        while (null != (m = pattern.exec(table))) {
            const codeStr = despan(m[1]);
            const name = fixWhitespace(despan(m[3].trim()));
            const description = fixWhitespace(m[4]);
            const code = parseInt(codeStr);
            console.log(`    ${code}: [ '${name}', '${description}' ],`);
        }
    }
}
