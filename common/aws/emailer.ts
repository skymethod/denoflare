import { Bytes } from '../bytes.ts';
import { AwsCall, AwsCallContext, signAwsCallV4 } from '../r2/r2.ts';

export type EmailerOpts = { readonly awsCallContext: AwsCallContext, readonly emailFrom: string, readonly emailTo: string, readonly region?: string, readonly endpoint?: string };

export type Email = { readonly subject: string, readonly text: string };

export type SendEmailResponse = { readonly status: number };

export class Emailer {

    private readonly opts: EmailerOpts;

    constructor(opts: EmailerOpts) {
        this.opts = opts;
    }

    async send(email: Email) {
        const { subject, text } = email;
        const { emailFrom: source, emailTo: to, awsCallContext: context, region, endpoint } = this.opts;
        const response = await sendEmail({ source, to, subject, text, context, region, endpoint });
        if (response.status !== 200) throw new Error(`Error status ${response.status} sending email, expected 200`);
    }

}

export async function sendEmail({ source, to, subject, text, context, region = 'us-east-1', endpoint = 'https://email.us-east-1.amazonaws.com' }: { source: string, to: string, subject: string, text: string, context: AwsCallContext, region?: string, endpoint?: string }): Promise<SendEmailResponse> {
    const params = new URLSearchParams();
    params.set('Action', 'SendEmail');
    params.set('Destination.ToAddresses.member.1', to);
    params.set('Message.Body.Text.Charset', 'UTF-8');
    params.set('Message.Body.Text.Data', text);
    params.set('Message.Subject.Charset', 'UTF-8');
    params.set('Message.Subject.Data', subject);
    params.set('Source', source);

    const body = Bytes.ofUtf8(params.toString());

    const call: AwsCall = {
        method: 'POST',
        service: 'email',
        region,
        url: new URL(endpoint),
        headers: new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
        body,
    };

    const { signedHeaders, bodyInfo } = await signAwsCallV4(call, context);

    const request = new Request(call.url.toString(), { method: call.method, headers: signedHeaders, body: bodyInfo.body });
    const { status } = await fetch(request);
    return { status };
}
