import { AwsCall, AwsCallContext, signAwsCallV4 } from '../r2/r2.ts';

async function execute<T>(opts: { method: 'GET', region: string, pathname: string, context: AwsCallContext, searchParams?: Record<string, string | number | undefined>  }): Promise<T | undefined>;
async function execute<T>(opts: { method: 'POST' | 'PUT', region: string, pathname: string, request: unknown, context: AwsCallContext, searchParams?: Record<string, string | number | undefined> }): Promise<T>;
async function execute<T>({ method, region, pathname, request, context, searchParams }: { method: 'GET' | 'POST' | 'PUT', region: string, pathname: string, request?: unknown, context: AwsCallContext, searchParams?: Record<string, string | number | undefined> }): Promise<T | undefined> {
    const service = 'lambda';
    const url = new URL(`https://${service}.${region}.amazonaws.com${pathname}`);
    for (const [ name, value ] of Object.entries(searchParams ?? {})) {
        if (value !== undefined) url.searchParams.set(name, value.toString());
    }
    const { body, headers } = request && (method === 'PUT' || method === 'POST') ? ({ headers: new Headers(), body: JSON.stringify(request, undefined, 2) }) : ({ body: '', headers: new Headers() });
    const call: AwsCall = { method, url, region, service, headers, body };
    const { signedHeaders, bodyInfo } = await signAwsCallV4(call, context);
    const res = await fetch(url.toString(), { method, headers: signedHeaders, body: bodyInfo.bodyLength === 0 ? undefined : bodyInfo.body });
    if (method === 'GET' && res.status === 404) return undefined;
    const expectedStatus = method === 'POST' ? 201 : 200;
    if (res.status !== expectedStatus) {
        throw new Error(`Bad status: ${res.status}, expected ${expectedStatus} body=${await res.text()}`);
    }
    return await res.json() as T;
}

// CreateFunction
// https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html

export async function createFunction({ request, context, region }: { request: CreateFunctionRequest, context: AwsCallContext, region: string }): Promise<FunctionConfiguration> {
    return await execute<FunctionConfiguration>({ method: 'POST', region, pathname: `/2015-03-31/functions`, request, context });
}

export type Architecture = 'x86_64' | 'arm64';

interface HasArchitectures {
    /** The instruction set architecture that the function supports. Architecture is a string array with one of the valid values. The default architecture value is x86_64 */
    Architectures?: Architecture[], // default: x86_64

}

interface HasFunctionName {
    /** The name of the function. */
    FunctionName: string,
}

interface CommonFunctionProperties {

    /** Environment variables that are accessible from function code during execution. */
    Environment?: {
        /** Environment variable key-value pairs.  */
        Variables: Record<string, string>;
    }

    /** The size of the function’s /tmp directory in MB. The default value is 512, but it can be any whole number between 512 and 10,240 MB. */
    EphemeralStorage?: {
        /**
         * The size of the function's /tmp directory in MB.
         * 
         * Minimum value of 512 (default). Maximum value of 10240.
         */
        Size: number; // 
    },

    /** The function that Lambda calls to begin running your function. */
    Handler?: string,

    /** 
     * The amount of memory available to the function at runtime. 
     * 
     * Increasing the function memory also increases its CPU allocation. The default value is 128 MB. The value can be any multiple of 1 MB.
     * 
     * Minimum value of 128 (default). Maximum value of 10240.
     */
    MemorySize?: number,

    /** The type of deployment package. Set to Image for container image and set Zip for .zip file archive. */
    PackageType?: 'Zip' | 'Image',

    /** The function's execution role. */
    Role: string, // arn:(aws[a-zA-Z-]*)?:iam::\d{12}:role/?[a-zA-Z_0-9+=,.@\-_/]+

    /** The identifier of the function's runtime. Runtime is required if the deployment package is a .zip file archive. */
    Runtime?: string,

    /** 
     * Amount of time (in seconds) that Lambda allows a function to run before stopping it. 
     * 
     * The default is 3 seconds. The maximum allowed value is 900 seconds. */
    Timeout?: number,
}

interface HasPublish {
    /** Set to true to publish the first version of the function during creation */
    Publish?: boolean,
}

interface HasZipFile {
    /** The base64-encoded contents of the deployment package. */
    ZipFile: string, // base64-encoded
}

interface HasStringLayers {
    /** A list of function layers to add to the function's execution environment. Specify each layer by its ARN, including the version. */
    Layers?: string[];

}

export interface CreateFunctionRequest extends CommonFunctionProperties, HasPublish, HasArchitectures, HasStringLayers, HasFunctionName { 
    /** The code for the function */
    Code: HasZipFile;
}

export interface FunctionConfiguration extends CommonFunctionProperties, HasFunctionName, HasArchitectures {

    /** The latest updated revision of the function or alias. */
    RevisionId: string; // e.g. 35dfd6e4-c17d-47bf-b3b7-aedce85e3bdb

    /** The date and time that the function was last updated, in ISO-8601 format (YYYY-MM-DDThh:mm:ss.sTZD). */
    LastModified: string; // e.g. 2023-07-07T19:53:36.604+0000

    /** The version of the Lambda function. */
    Version: string; // e.g. 1

    /** The function's Amazon Resource Name (ARN). */
    FunctionArn: string; // e.g. arn:aws:lambda:<region>:<account-id>:function:<name>

    /** The SHA256 hash of the function's deployment package. */
    CodeSha256: string; // e.g. TR9bZA2Owei7po/W5puaLL0DnWrg1RtAyqlszGKyaek=

    /** The size of the function's deployment package, in bytes. */
    CodeSize: number; // e.g. 12345

    /** The ARN of the runtime and any errors that occured. */
    RuntimeVersionConfig: {
        Error: Record<string, unknown> | null,
        RuntimeVersionArn: string | null, // e.g. arn:aws:lambda:<region>::runtime:<64-hexchars>
    }

    /** The current state of the function. When the state is Inactive, you can reactivate the function by invoking it. */
    State: string; // Pending | Active | Inactive | Failed

    /** The reason for the function's current state. */
    StateReason: string; // e.g. The function is being created.

    /** The reason code for the function's current state. When the code is Creating, you can't invoke or modify the function. */
    StateReasonCode: string; // Idle | Creating | Restoring | EniLimitExceeded | InsufficientRolePermissions | InvalidConfiguration | InternalError | SubnetOutOfIPAddresses | InvalidSubnet | InvalidSecurityGroup | ImageDeleted | ImageAccessDenied | InvalidImage | KMSKeyAccessDenied | KMSKeyNotFound | InvalidStateKMSKey | DisabledKMSKey | EFSIOError | EFSMountConnectivityError | EFSMountFailure | EFSMountTimeout | InvalidRuntime | InvalidZipFileException | FunctionError

    /** The function's layers. */
    Layers: {
        /** The Amazon Resource Name (ARN) of the function layer. */
        Arn: string; // layer version arn

        /** The size of the layer archive in bytes. */
        CodeSize: number;
    }[] | null;
}

// UpdateFunctionConfiguration
// https://docs.aws.amazon.com/lambda/latest/dg/API_UpdateFunctionConfiguration.html

export async function updateFunctionConfiguration({ functionName, request, context, region }: { functionName: string, request: UpdateFunctionConfigurationRequest, context: AwsCallContext, region: string }): Promise<FunctionConfiguration> {
    return await execute<FunctionConfiguration>({ method: 'PUT', region, pathname: `/2015-03-31/functions/${functionName}/configuration`, request, context });
}

export interface UpdateFunctionConfigurationRequest extends CommonFunctionProperties, HasStringLayers {
    
}

// GetFunctionConfiguration
// https://docs.aws.amazon.com/lambda/latest/dg/API_GetFunctionConfiguration.html

export async function getFunctionConfiguration({ functionName, qualifier, context, region }: { functionName: string, qualifier?: string, context: AwsCallContext, region: string }): Promise<FunctionConfiguration | undefined> {
    return await execute<FunctionConfiguration>({ method: 'GET', region, pathname: `/2015-03-31/functions/${functionName}/configuration`, context, searchParams: { Qualifier: qualifier } });
}

// UpdateFunctionCode
// https://docs.aws.amazon.com/lambda/latest/dg/API_UpdateFunctionCode.html

export async function updateFunctionCode({ functionName, request, context, region }: { functionName: string, request: UpdateFunctionCodeRequest, context: AwsCallContext, region: string }): Promise<FunctionConfiguration> {
    return await execute<FunctionConfiguration>({ method: 'PUT', region, pathname: `/2015-03-31/functions/${functionName}/code`, request, context });
}

export interface UpdateFunctionCodeRequest extends HasArchitectures, HasZipFile, HasPublish {
    /** Set to true to validate the request parameters and access permissions without modifying the function code. */
    DryRun?: boolean;

    /** Update the function only if the revision ID matches the ID that's specified. Use this option to avoid modifying a function that has changed since you last read it. */
    RevisionId?: string;
}

// CreateFunctionUrlConfig
// https://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunctionUrlConfig.html

export async function createFunctionUrlConfig({ functionName, qualifier, request, context, region }: { functionName: string, qualifier?: string, request: CreateFunctionUrlConfigRequest, context: AwsCallContext, region: string }): Promise<FunctionUrlConfig> {
    return await execute<FunctionUrlConfig>({ method: 'POST', region, pathname: `/2021-10-31/functions/${functionName}/url`, request, context, searchParams: { Qualifier: qualifier } });
}

export interface CreateFunctionUrlConfigRequest {
    /** The type of authentication that your function URL uses. Set to AWS_IAM if you want to restrict access to authenticated users only. Set to NONE if you want to bypass IAM authentication to create a public endpoint.  */
    AuthType: 'NONE' | 'AWS_IAM';
    /** The cross-origin resource sharing (CORS) settings for your function URL. */
    Cors?: {
        /** Whether to allow cookies or other credentials in requests to your function URL. The default is false. */
        AllowCredentials?: boolean;

        /** The HTTP headers that origins can include in requests to your function URL. For example: Date, Keep-Alive, X-Custom-Header. */
        AllowHeaders?: string[];

        /** The HTTP methods that are allowed when calling your function URL. For example: GET, POST, DELETE, or the wildcard character (*). */
        AllowMethods?: string[];

        /** The origins that can access your function URL. 
         * 
         * You can list any number of specific origins, separated by a comma. For example: https://www.example.com, http://localhost:60905. Alternatively, you can grant access to all origins using the wildcard character (*). */
        AllowOrigins?: string[];

        /** The HTTP headers in your function response that you want to expose to origins that call your function URL. For example: Date, Keep-Alive, X-Custom-Header. */
        ExposeHeaders?: string[];

        /** The maximum amount of time, in seconds, that web browsers can cache results of a preflight request. By default, this is set to 0, which means that the browser doesn't cache results. */
        MaxAge?: number;
    } | null,

    /**
     * BUFFERED or RESPONSE_STREAM
     * 
     * BUFFERED - This is the default option. Lambda invokes your function using the Invoke API operation. Invocation results are available when the payload is complete. The maximum payload size is 6 MB.
     * 
     * RESPONSE_STREAM – Your function streams payload results as they become available. Lambda invokes your function using the InvokeWithResponseStream API operation. The maximum response payload size is 20 MB, however, you can request a quota increase.
     */
    InvokeMode?: 'BUFFERED' | 'RESPONSE_STREAM' | null;
}

export interface FunctionUrlConfig extends CreateFunctionUrlConfigRequest {
    /** When the function URL was created, in ISO-8601 format (YYYY-MM-DDThh:mm:ss.sTZD). */
    CreationTime: string;

    /** The Amazon Resource Name (ARN) of your function. */
    FunctionArn: string;

    /** The HTTP URL endpoint for your function. */
    FunctionUrl: string; // https://<32-loweralphanum>.lambda-url.<region>.on.aws/

    /** When the function URL configuration was last updated, in ISO-8601 format (YYYY-MM-DDThh:mm:ss.sTZD). */
    LastModifiedTime?: string;
}

// GetFunctionUrlConfig
// https://docs.aws.amazon.com/lambda/latest/dg/API_GetFunctionUrlConfig.html

export async function getFunctionUrlConfig({ functionName, qualifier, context, region }: { functionName: string, qualifier?: string, context: AwsCallContext, region: string }): Promise<FunctionUrlConfig | undefined> {
    return await execute<FunctionUrlConfig>({ method: 'GET', region, pathname: `/2021-10-31/functions/${functionName}/url`, context, searchParams: { Qualifier: qualifier } });
}

// GetPolicy
// https://docs.aws.amazon.com/lambda/latest/dg/API_GetPolicy.html

export async function getPolicy({ functionName, qualifier, context, region }: { functionName: string, qualifier?: string, context: AwsCallContext, region: string }): Promise<PolicyResponse | undefined> {
    return await execute<PolicyResponse>({ method: 'GET', region, pathname: `/2015-03-31/functions/${functionName}/policy`, context, searchParams: { Qualifier: qualifier } });
}

export interface PolicyResponse {

    /** The resource-based policy. */
    Policy: string;

    /** A unique identifier for the current revision of the policy. */
    RevisionId: string;
}

export interface Policy {
    Version: string; // 2012-10-17
    Id: string; // default
    Statement: Statement[];
}

export interface Statement {
    Sid: string; // FunctionURLAllowPublicAccess
    Effect: string; // Allow
    Principal: string; // *
    Action: string; // lambda:InvokeFunctionUrl
    Resource: string; // arn:aws:lambda:<region>:<account-id>:function:<function-name>
    Condition?: {
        StringEquals?: {
            'lambda:FunctionUrlAuthType'?: string; // NONE
        }
    }
}

// AddPermission
// https://docs.aws.amazon.com/lambda/latest/dg/API_AddPermission.html

export async function addPermission({ functionName, qualifier, request, context, region }: { functionName: string, qualifier?: string, request: AddPermissionRequest, context: AwsCallContext, region: string }): Promise<AddPermissionResponse> {
    return await execute<AddPermissionResponse>({ method: 'POST', region, pathname: `/2015-03-31/functions/${functionName}/policy`, request, context, searchParams: { Qualifier: qualifier } });
}

export interface AddPermissionRequest {
    /** The action that the principal can use on the function.
     * 
     * For example, lambda:InvokeFunction or lambda:GetFunction. */
    Action: string;

    /** The type of authentication that your function URL uses. Set to AWS_IAM if you want to restrict access to authenticated users only. Set to NONE if you want to bypass IAM authentication to create a public endpoint. */
    FunctionUrlAuthType?: 'NONE' | 'AWS_IAM';

    /** The AWS service or AWS account that invokes the function. If you specify a service, use SourceArn or SourceAccount to limit who can invoke the function through that service. */
    Principal: string;

    /** Update the policy only if the revision ID matches the ID that's specified. Use this option to avoid modifying a policy that has changed since you last read it. */
    RevisionId?: string;

    /** A statement identifier that differentiates the statement from others in the same policy. */
    StatementId: string;

}

export interface AddPermissionResponse {
    /** The permission statement that's added to the function policy. */
    Statement: string;
}

// PublishLayerVersion
// https://docs.aws.amazon.com/lambda/latest/dg/API_PublishLayerVersion.html

export async function publishLayerVersion({ layerName, request, context, region }: { layerName: string, request: PublishLayerVersionRequest, context: AwsCallContext, region: string }): Promise<LayerVersionWithContent> {
    return await execute<LayerVersionWithContent>({ method: 'POST', region, pathname: `/2018-10-31/layers/${layerName}/versions`, request, context });
}

export interface PublishLayerVersionRequest {
    CompatibleArchitectures?: Architecture[];
    CompatibleRuntimes?: string[];
    Content: HasZipFile;
    Description?: string;
    LicenseInfo?: string;
}

export interface LayerVersion {
    CompatibleRuntimes: string[];
    CompatibleArchitectures: Architecture[];
    CreatedDate: string; // 2023-07-08T16:07:13.897+0000
    Version: number;
    LayerVersionArn: string; // arn:aws:lambda:<region>:<account-id>:layer:<layer-name>:<version>
    LicenseInfo: string | null;
    Description: string | null;
}

export interface LayerVersionWithContent extends LayerVersion {
    Content: {
        CodeSha256: string; // base64
        CodeSize: number;
        Location: string; // https://prod-04-2014-layers.s3.<region>.amazonaws.com/snapshots/<account-id>/<layer-name>-b92bfd73-559a-43af-8169-56f78f8fad74?versionId=<opaque>&X-Amz-Security-Token=<opaque>&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20230708T160705Z&X-Amz-SignedHeaders=host&X-Amz-Expires=600&X-Amz-Credential=<credential>&X-Amz-Signature=<signature>
    },
    LayerArn: string; // arn:aws:lambda:<region>:<account-id>:layer:<layer-name>
}

// ListLayerVersions
// https://docs.aws.amazon.com/lambda/latest/dg/API_ListLayerVersions.html

export async function listLayerVersions({ layerName, request, context, region }: { layerName: string, request?: ListLayerVersionsRequest, context: AwsCallContext, region: string }): Promise<ListLayerVersionsResponse> {
    return (await execute<ListLayerVersionsResponse>({ method: 'GET', region, pathname: `/2018-10-31/layers/${layerName}/versions`, context, searchParams: { ...request } }))!;
}

export interface ListLayerVersionsRequest {
    CompatibleArchitecture?: Architecture;
    CompatibleRuntime?: string;
    Marker?: string;

    /** The maximum number of versions to return.
     * 
     * Minimum value of 1. Maximum value of 50.
     */
    MaxItems?: number;
}

export interface ListLayerVersionsResponse {
    LayerVersions: LayerVersion[];
    NextMarker: string | null;
}

// GetLayerVersion
// https://docs.aws.amazon.com/lambda/latest/dg/API_GetLayerVersion.html

export async function getLayerVersion({ layerName, versionNumber, context, region }: { layerName: string, versionNumber: number, context: AwsCallContext, region: string }): Promise<LayerVersionWithContent | undefined> {
    return await execute<LayerVersionWithContent>({ method: 'GET', region, pathname: `/2018-10-31/layers/${layerName}/versions/${versionNumber}`, context });
}
