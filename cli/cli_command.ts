export class CliCommand<T> {

    private readonly command: string[];
    private readonly description: string;
    private readonly version: string | undefined;
    private readonly argDefs: ArgDef[] = [];
    private readonly optionDefs: OptionDef[] = [];

    private constructor(command: string[], description: string, version: string | undefined) {
        this.command = command;
        this.description = description;
        this.version = version;
    }

    //

    static of(command: string[], description: string, opts?: { version?: string }): CliCommand<{ verbose: boolean }> {
        const { version } = opts ?? {};
        return new CliCommand(command, description, version);
    }
    
    arg<K extends string>(name: K, type: 'string', description: string): CliCommand<T & Record<K, string>> {
        this.argDefs.push({ camelName: name, kebabName: camelCaseToKebabCase(name), type, description });
        // deno-lint-ignore no-explicit-any
        return this as any;
    }

    option<K extends string>(name: K, type: 'string', description: string): CliCommand<T & Record<K, string | undefined>>;
    option<K extends string>(name: K, type: 'integer', description: string, opts?: { min?: number, max?: number }): CliCommand<T & Record<K, number | undefined>>;
    option<K extends string>(name: K, type: 'enum', description: string, ...enumDefs: EnumDef[]): CliCommand<T & Record<K, string | undefined>>;
    option<K extends string>(name: K, type: 'boolean', description: string): CliCommand<T & Record<K, boolean | undefined>>;
    option<K extends string, V>(name: K, type: string, description: string, optsOrEnumDefs: Record<string, unknown> | EnumDef[] = {}): CliCommand<T & Record<K, V>> {
        const opts = Array.isArray(optsOrEnumDefs) ? { enumDefs: optsOrEnumDefs } 
            : 'value' in optsOrEnumDefs && 'description' in optsOrEnumDefs ? { enumDefs: [ optsOrEnumDefs ] } 
            : optsOrEnumDefs;
        this.optionDefs.push({ camelName: name, kebabName: camelCaseToKebabCase(name), type, description, opts });
        // deno-lint-ignore no-explicit-any
        return this as any;
    }

    parse(args: (string | number)[], options: Record<string, unknown>): T {
        const { argDefs } = this;
        const allOptionDefs = [ ...this.optionDefs, VERBOSE ];
        if (args.length !== argDefs.length) throw new Error(`Expected ${argDefs.length} argument${argDefs.length === 1 ? '' : 's'}, found ${args.length}, try --help`);
        const rt: Record<string, unknown> = {};
        for (let i = 0; i < argDefs.length; i++) {
            const argDef = argDefs[i];
            const arg = args[i];
            rt[argDef.camelName] = typeof arg === 'string' ? arg : String(arg);
        }
        for (const [ optionNameKebab, optionValue ] of Object.entries(options)) {
            if (optionNameKebab === '_') continue;
            const optionDef = allOptionDefs.find(v => optionNameKebab === v.kebabName);
            if (!optionDef) throw new Error(`Unknown option: ${optionNameKebab}, try --help`);
            rt[optionDef.camelName] = parseOptionValue(optionValue, optionDef);
        }
        // deno-lint-ignore no-explicit-any
        return rt as any;
    }

    dump(args: (string | number)[], options: Record<string, unknown>): boolean {
        const { command, description, version, argDefs, optionDefs } = this;
        if (!(args.length < argDefs.length || options.help)) return false;

        const argRows = [...argDefs.map(v => [`    <${v.kebabName}>`, v.description])];
        const makeOptionRow = (v: OptionDef) => [`    --${v.kebabName}`, computeOptionDescription(v)];
        const optionRows = [...optionDefs.map(makeOptionRow), ['', ''], ...[HELP, VERBOSE].map(makeOptionRow) ];
        const columnLength = Math.max(...[...optionRows, ...argRows].map(v => v[0].length)) + 2;

        const lines = [
            `${command.join('-')}${version ? ` ${version}` : ''}`,
            description,
            '',
            'USAGE:',
            `    ${command.join(' ')}${argDefs.map(v => ` <${v.kebabName}>`)} [OPTIONS]`,
        ];
        if (argDefs.length > 0) {
            lines.push(
                '',
                'ARGS:',
                ...argRows.map(v => v[0].padEnd(columnLength) + v[1])
            );
        }
        lines.push(
            '',
            'OPTIONS:',
            ...optionRows.map(v => v[0].padEnd(columnLength) + v[1])
        );
        for (const line of lines) {
            console.log(line);
        }
        return true;
    }

}

export type EnumDef = { value: string, description: string, default?: boolean };

//

type ArgDef = { camelName: string, kebabName: string, type: string, description: string };
type OptionDef = { camelName: string, kebabName: string, type: string, description: string, opts: Record<string, unknown> };

const VERBOSE = makeInternalBooleanOption('verbose', 'Toggle verbose output (when applicable)');
const HELP = makeInternalBooleanOption('help', 'Print help information');

function makeInternalBooleanOption(name: string, description: string): OptionDef {
    return { camelName: name, kebabName: camelCaseToKebabCase(name), type: 'boolean', description, opts: {} };
}

function camelCaseToKebabCase(name: string): string {
    let rt = '';
    let prevCategory = 'lower';
    for (const char of name) {
        const category = char >= 'a' && char <= 'z' ? 'lower' : char >= 'A' && char <= 'Z' ? 'upper' : char >= '0' && char <= '9' ? 'digit' : undefined;
        if (category === undefined) throw new Error(`Unable to convert '${name}' to kebab case, unsupported character '${char}'`);
        if (category !== prevCategory) rt += '-';
        rt += category === 'upper' ? char.toLowerCase() : char;
        prevCategory = category === 'upper' && prevCategory === 'lower' ? 'lower' : category;
    }
    return rt;
}

function computeOptionDescription(def: OptionDef): string {
    const { description } = def;
    const { min, max } = tryGetIntegerOpts(def) ?? {};
    const constraints: string[] = [];
    if (typeof min === 'number') constraints.push(`min: ${min}`);
    if (typeof max === 'number') constraints.push(`max: ${max}`);
    const enumDefs = tryGetEnumDefs(def);
    if (enumDefs) constraints.push(`one of: ${enumDefs.map(v => v.value).join(', ')}`);
    return description + (constraints.length > 0 ? ` (${constraints.join(', ')})` : '');
}

function parseOptionValue(value: unknown, def: OptionDef) {
    const { type, kebabName } = def;
    if (type === 'string') {
        if (value === undefined || typeof value === 'string') return value;
        if (typeof value === 'number') return String(value);
    } else if (type === 'integer') {
        if (value === undefined) return undefined;
        if (typeof value === 'number') {
            if (value !== Math.round(value)) throw new Error(`Bad ${kebabName}: ${value}, expected integer`);
            const { min, max } = tryGetIntegerOpts(def) ?? {};
            if (typeof min === 'number' && value < min) throw new Error(`Bad ${kebabName}: ${value}, min: ${min}`);
            if (typeof max === 'number' && value > max) throw new Error(`Bad ${kebabName}: ${value}, max: ${max}`);
            return value;
        }
    } else if (type === 'boolean') {
        if (value === undefined || typeof value === 'boolean') return value;
    } else if (type === 'enum') {
        if (value === undefined) return undefined;
        if (typeof value === 'string' || typeof value === 'number') {
            const str = typeof value === 'string' ? value : String(value);
            const enumDefs = tryGetEnumDefs(def);
            if (enumDefs === undefined) throw new Error(`Missing ${def.camelName}.enumDefs`);
            const values = enumDefs.map(v => v.value);
            if (!values.includes(str)) throw new Error(`Bad ${kebabName}: ${value}, expected one of: ${values.join(', ')}`);
            return str;
        }
    }
    if (typeof value === 'boolean') throw new Error(`Bad ${kebabName}: expected value`);
    throw new Error(`Unable to parse '${value}' as '${type}'`);
}

function tryGetIntegerOpts(def: OptionDef): { min?: number, max?: number } | undefined {
    const { type, camelName, opts } = def;
    if (type === 'integer') {
        const { min, max } = opts;
        if (min !== undefined && typeof min !== 'number') throw new Error(`Bad ${camelName}.min: ${min}`);
        if (max !== undefined && typeof max !== 'number') throw new Error(`Bad ${camelName}.max: ${max}`);
        if (typeof min === 'number' && typeof max === 'number' && max <= min) throw new Error(`Bad ${camelName}.max: ${max}`);
        return { min, max };
    }
    return undefined;
}

function tryGetEnumDefs(def: OptionDef): EnumDef[] | undefined {
    const { type, opts } = def;
    if (type === 'enum') {
        const { enumDefs } = opts;
        if (Array.isArray(enumDefs)) return enumDefs;
    }
    return undefined;
}
