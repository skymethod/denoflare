export class CliCommand<T> {
    private readonly command: readonly string[];
    private readonly description: string | undefined;
    private readonly version: string | undefined;
    private readonly argDefs: ArgDef[] = [];
    private readonly optionDefs: OptionDef[] = [];
    private readonly optionGroupIndexes = new Set<number>();
    private readonly subcommandDefs: SubcommandDef[] = [];
    private readonly subcommandGroupIndexes = new Set<number>();

    private constructor(command: string[], description: string | undefined, version: string | undefined) {
        this.command = command;
        this.description = description;
        this.version = version;
    }

    //

    static of(command: string[], description?: string, opts?: { version?: string }): CliCommand<{ verbose: boolean }> {
        const { version } = opts ?? {};
        return new CliCommand(command, description, version);
    }

    arg<K extends string>(name: K, type: 'string', description: string): CliCommand<T & Record<K, string>>;
    arg<K extends string>(name: K, type: 'strings', description: string): CliCommand<T & Record<K, string[]>>;
    arg<K extends string, V>(name: K, type: 'string' | 'strings', description: string): CliCommand<T & Record<K, V>> {
        this.argDefs.push({ camelName: name, kebabName: camelCaseToKebabCase(name), type, description });
        // deno-lint-ignore no-explicit-any
        return this as any;
    }

    option<K extends string>(name: K, type: 'string', description: string, opts?: { hint: string }): CliCommand<T & Record<K, string | undefined>>;
    option<K extends string>(name: K, type: 'strings', description: string, opts?: { hint: string }): CliCommand<T & Record<K, string[] | undefined>>;
    option<K extends string>(name: K, type: 'required-string', description: string, opts?: { hint: string }): CliCommand<T & Record<K, string>>;
    option<K extends string>(name: K, type: 'integer', description: string, opts?: { hint?: string, min?: number, max?: number }): CliCommand<T & Record<K, number | undefined>>;
    option<K extends string>(name: K, type: 'required-integer', description: string, opts?: { hint?: string, min?: number, max?: number }): CliCommand<T & Record<K, number>>;
    option<K extends string>(name: K, type: 'enum', description: string, ...enumDefs: EnumDef[]): CliCommand<T & Record<K, string | undefined>>;
    option<K extends string>(name: K, type: 'required-enum', description: string, ...enumDefs: EnumDef[]): CliCommand<T & Record<K, string>>;
    option<K extends string>(name: K, type: 'boolean', description: string): CliCommand<T & Record<K, boolean | undefined>>;
    option<K extends string>(name: K, type: 'name-value-pairs', description: string): CliCommand<T & Record<K, Record<string, string> | undefined>>;
    option<K extends string, V>(name: K, type: OptionType, description: string, _?: unknown): CliCommand<T & Record<K, V>> {
        const rest = [...arguments].slice(3);
        const opts: Record<string, unknown> = rest.length === 0 ? {} 
            : rest.length === 1 && 'value' in rest[0] ? { enumDefs: [ rest[0] ]}
            : rest.length === 1 ? rest[0]
            : { enumDefs: rest };
        this.optionDefs.push({ camelName: name, kebabName: camelCaseToKebabCase(name), type, description, opts });
        // deno-lint-ignore no-explicit-any
        return this as any;
    }

    optionGroup(): CliCommand<T> {
        const index = this.optionDefs.length - 1;
        if (index >= 0) this.optionGroupIndexes.add(index);
        return this;
    }

    include(modifier: CliCommandModifier): CliCommand<T> {
        modifier(this);
        return this;
    }

    subcommand(subcommand: CliCommand<unknown>, handler: SubcommandHandler): CliCommand<T> {
        const subcommandStr = subcommand.command.join('|');
        const thisStr = this.command.join('|');
        if (!subcommandStr.startsWith(thisStr + '|') || subcommandStr.substring(thisStr.length + 1).includes('|')) {
            throw new Error(`Bad subcommand: ${subcommand.command.join(' ')} for parent ${this.command.join(' ')}`);
        }
        const kebabName = subcommand.command.at(-1)!;
        const description = subcommand.description ?? '';
        this.subcommandDefs.push({ kebabName, description, handler });
        return this;
    }

    subcommandGroup(): CliCommand<T> {
        const index = this.subcommandDefs.length - 1;
        if (index >= 0) this.subcommandGroupIndexes.add(index);
        return this;
    }

    async routeSubcommand(args: (string | number)[], options: Record<string, unknown>, other: Record<string, SubcommandHandler> = {}) {
        if (this.dumpHelp(args, options, other)) return;

        const subcommand = argToString(args[0]);
        const def = this.subcommandDefs.find(v => v.kebabName === subcommand);
        if (def) {
            await def.handler(args.slice(1), options);
        } else {
            const otherHandler = findOtherSubcommandHandler(subcommand, other);
            if (otherHandler) {
                await otherHandler(args.slice(1), options);
            } else {
                throw new Error(`Unknown subcommand: ${subcommand}, try --help`);
            }
        }
    }

    parse(args: (string | number)[], options: Record<string, unknown>): T {
        const { argDefs } = this;
        const allOptionDefs = [ ...this.optionDefs, VERBOSE ];
        if (args.length < argDefs.length) throw new Error(`Expected at least ${argDefs.length} argument${argDefs.length === 1 ? '' : 's'}, found ${args.length}, try --help`);
        const rt: Record<string, unknown> = {};
        for (let i = 0; i < argDefs.length; i++) {
            const argDef = argDefs[i];
            if (argDef.type === 'strings') {
                rt[argDef.camelName] = args.slice(i).map(argToString);
                break;
            } else {
                const arg = args[i];
                rt[argDef.camelName] = argToString(arg);
            }
        }
        for (const [ optionNameKebab, optionValue ] of Object.entries(options)) {
            if (optionNameKebab === '_') continue;
            const optionDef = allOptionDefs.find(v => optionNameKebab === v.kebabName);
            if (!optionDef) throw new Error(`Unknown option: ${optionNameKebab}, try --help`);
            rt[optionDef.camelName] = parseOptionValue(optionValue, optionDef);
        }
        for (const optionDef of allOptionDefs) {
            if ((optionDef.type.startsWith('required-')) && !(optionDef.camelName in rt)) {
                throw new Error(`Missing required option: --${optionDef.kebabName}`);
            }
        }
        // deno-lint-ignore no-explicit-any
        return rt as any;
    }

    dumpHelp(args: (string | number)[], options: Record<string, unknown>, other: Record<string, SubcommandHandler> = {}): boolean {
        const { command, description, version, argDefs, optionDefs, optionGroupIndexes, subcommandDefs, subcommandGroupIndexes } = this;

        const dump = subcommandDefs.length > 0 ? (args.length === 0 || !subcommandDefs.some(v => v.kebabName === args[0]) && !Object.keys(other).map(camelCaseToKebabCase).includes(String(args[0])))
            : (args.length < argDefs.length || options.help);
        if (!dump) return false;

        const argRows = [...argDefs.map(v => [`    <${v.kebabName}>`, v.description])];
        const optionRows = computeOptionRows(optionDefs, optionGroupIndexes)
        const subcommandRows = computeSubcommandRows(subcommandDefs, subcommandGroupIndexes);
        const columnLength = Math.max(...[...optionRows, ...argRows, ...subcommandRows].map(v => v[0].length)) + 2;

        const commandType = command.length === 1 ? 'command' : 'subcommand';
        const lines = [
            `${command.join('-')}${version ? ` ${version}` : ''}`,
            ...(description ? ['', description] : []),
            '',
            'USAGE:',
            this.subcommandDefs.length > 0 ? `    ${command.join(' ')} <${commandType}> <args> <options>` : `    ${command.join(' ')}${argDefs.map(v => v.type === 'strings' ? ` <${v.kebabName}> <${v.kebabName}>...` : ` <${v.kebabName}>`).join('')} [OPTIONS]`,
        ];
        if (argDefs.length > 0) {
            lines.push(
                '',
                'ARGS:',
                ...argRows.map(v => v[0].padEnd(columnLength) + v[1])
            );
        }
        if (this.subcommandDefs.length > 0) {
            lines.push(
                '',
                `${commandType.toUpperCase()}S:`,
                ...subcommandRows.map(v => v[0].padEnd(columnLength) + v[1]),
            '',
            `For ${commandType}-specific help: ${command.join(' ')} <${commandType}> --help`,)
        } else {
            lines.push(
                '',
                'OPTIONS:',
                ...optionRows.map(v => v[0].padEnd(columnLength) + v[1])
            );
        }

        for (const line of lines) {
            console.log(line);
        }
        return true;
    }

}

export type EnumDef = { value: string, description?: string, default?: boolean };

export type SubcommandHandler = (args: (string|number)[], options: Record<string,unknown>) => Promise<unknown> | void;

export type CliCommandModifier = (command: CliCommand<unknown>) => void;

//

type ArgDef = { camelName: string, kebabName: string, type: string, description: string };
type OptionDef = { camelName: string, kebabName: string, type: OptionType, description: string, opts: Record<string, unknown> };
type OptionType = 'string' | 'strings' | 'required-string' | 'integer' | 'required-integer' | 'boolean' | 'enum' | 'required-enum' | 'name-value-pairs';
type SubcommandDef = { kebabName : string, description: string, handler: SubcommandHandler };

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
        if (category !== prevCategory && category === 'upper') rt += '-';
        rt += category === 'upper' ? char.toLowerCase() : char;
        prevCategory = category;
    }
    return rt;
}

function computeOptionDescription(def: OptionDef): string {
    const { description } = def;
    const { min, max } = tryGetIntegerOpts(def) ?? {};
    const constraints: string[] = [];
    if (def.type.startsWith('required-')) constraints.push('required');
    if (typeof min === 'number') constraints.push(`min: ${min}`);
    if (typeof max === 'number') constraints.push(`max: ${max}`);
    const enumDefs = tryGetEnumDefs(def);
    if (enumDefs) constraints.push(`one of: ${enumDefs.map(v => v.value).join(', ')}`);
    const defaultEnumDef = (enumDefs ?? []).find(v => v.default);
    if (defaultEnumDef) constraints.push(`default: ${defaultEnumDef.value}`);
    return description + (constraints.length > 0 ? ` (${constraints.join(', ')})` : '');
}

function parseOptionValue(value: unknown, def: OptionDef) {
    const { type, kebabName } = def;

    if (type === 'string' || type === 'required-string') {
        if (value === undefined || typeof value === 'string') return value;
        if (typeof value === 'number') return String(value);
    } else if (type === 'strings') {
        if (value === undefined) return undefined;
        if (typeof value === 'string') return [ value ];
        if (Array.isArray(value)) return value.map(v => String(v));
    } else if (type === 'integer' || type === 'required-integer') {
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
    } else if (type === 'enum' || type === 'required-enum') {
        if (value === undefined) return undefined;
        if (typeof value === 'string' || typeof value === 'number') {
            const str = typeof value === 'string' ? value : String(value);
            const enumDefs = tryGetEnumDefs(def);
            if (enumDefs === undefined) throw new Error(`Missing ${def.camelName}.enumDefs`);
            const values = enumDefs.map(v => v.value);
            if (!values.includes(str)) throw new Error(`Bad ${kebabName}: ${value}, expected one of: ${values.join(', ')}`);
            return str;
        }
    } else if (type === 'name-value-pairs') {
        if (value === undefined) return undefined;

        const rt: Record<string, string> = {};
        if (typeof value === 'string')  {
            const { name, value: value_ } = parseNameValue(value);
            rt[name] = value_;
            return rt;
        } else if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
            for (const item of value) {
                const { name, value: value_ } = parseNameValue(item);
                rt[name] = value_;
            }
            return rt;
        } else {
            throw new Error(`Bad ${kebabName}: ${value}`);
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

function computeOptionRows(optionDefs: OptionDef[], optionGroupIndexes: Set<number>): string[][] {
    const rt: string[][] = [];
    const addGroupBreak = () => rt.push(['', '']);
    optionDefs.forEach((v, i) => {
        rt.push(computeOptionRow(v));
        if (optionGroupIndexes.has(i)) addGroupBreak();
    });
    addGroupBreak();
    rt.push(computeOptionRow(HELP));
    rt.push(computeOptionRow(VERBOSE));
    return rt;
}

function computeSubcommandRows(subcommandDefs: SubcommandDef[], subcommandGroupIndexes: Set<number>): string[][] {
    const rt: string[][] = [];
    const addGroupBreak = () => rt.push(['', '']);
    subcommandDefs.forEach((v, i) => {
        rt.push([`    ${v.kebabName}`, v.description]);
        if (subcommandGroupIndexes.has(i)) addGroupBreak();
    });
    return rt;
}

function computeOptionRow(def: OptionDef): [string, string] {
    const { type, opts, kebabName } = def;
    const hint = typeof opts.hint === 'string' ? `<${opts.hint}>${type === 'strings' || type === 'name-value-pairs' ? '...' : ''}`
        : type === 'string' || type === 'required-string' ? '<string>' 
        : type === 'strings' ? '<string>...' 
        : type === 'enum' || type === 'required-enum' ? `<${kebabName}>`
        : type === 'integer' || type === 'required-integer' ? '<integer>' 
        : type === 'name-value-pairs' ? '<name=value>...' 
        : undefined;
    return  [`    --${def.kebabName}${hint ? ` ${hint}` : ''}`, computeOptionDescription(def)];
}

function parseNameValue(str: string): { name: string, value: string} {
    const i = str.indexOf('=');
    if (i < 0) throw new Error(`Bad name value: ${str}`);
    const name = str.substring(0, i);
    const value = str.substring(i + 1);
    return { name, value };
}

function findOtherSubcommandHandler(subcommand: string, other: Record<string, SubcommandHandler>): SubcommandHandler | undefined {
    for (const [otherCamelName, otherHandler] of Object.entries(other)) {
        if (camelCaseToKebabCase(otherCamelName) === subcommand) {
            return otherHandler;
        }
    }
}

function argToString(v: number | string): string {
    return typeof v === 'string' ? v : String(v);
}
