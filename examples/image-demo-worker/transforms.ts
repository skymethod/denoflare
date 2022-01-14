export interface Transform {
    readonly name: string;
    readonly parameters: readonly TransformParameter[];
}

export interface TransformParameter {
    readonly name: string;
    readonly type: TransformParameterType;
}

export type TransformParameterType = FloatParameterType | IntParameterType | EnumParameterType | RgbParameterType | ChannelParameterType;

export interface FloatParameterType {
    kind: 'float';
    min: number;
    max: number;
    default?: number;
}

export interface IntParameterType {
    kind: 'int';
    min: number;
    max: number;
    default?: number;
}

export interface EnumParameterType {
    kind: 'enum';
    values: readonly string[];
}

export interface RgbParameterType {
    kind: 'rgb';
}

export interface ChannelParameterType {
    kind: 'channel';
    // 0 = red, 1 = green, 2 = blue
}
