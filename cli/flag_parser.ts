export function parseFlags(denoArgs: string[]): { args: (string | number)[], options: Record<string, unknown> } {
    const args: (string | number)[] = [];
    const options: Record<string, unknown> = {};

    const addOption = (name: string, value: string | number | boolean) => {
        const existing = options[name];
        if (existing === undefined) {
            options[name] = value;
        } else if (Array.isArray(existing)) {
            existing.push(value);
        } else {
            options[name] = [ existing, value ];
        }
    };

    let currentOptionName: string | undefined;
    for (const denoArg of denoArgs) {
        const optionName = tryParseOptionName(denoArg);
        if (optionName) {
            if (currentOptionName) {
                addOption(currentOptionName, true);
            }
            currentOptionName = optionName;
            continue;
        }
        const value = /^true$/i.test(denoArg) ? true
            : /^false$/i.test(denoArg) ? false
            : /^-?\d+$/.test(denoArg) ? parseInt(denoArg)
            : /^-?\d+\.\d+$/.test(denoArg) ? parseFloat(denoArg)
            : denoArg;
        if (currentOptionName) {
            addOption(currentOptionName, value);
            currentOptionName = undefined;
        } else {
            if (Object.keys(options).length > 0) throw new Error(`Named options must come after positional arguments`);
            args.push(typeof value === 'boolean' ? String(value) : value);
        }
    }
    if (currentOptionName) {
        addOption(currentOptionName, true);
    }

    return { args, options };
}

//

function tryParseOptionName(denoArg: string): string | undefined {
    const m = /^--([^\s]+)$/.exec(denoArg);
    return m ? m[1] : undefined;
}
