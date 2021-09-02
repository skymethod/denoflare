# denoflare
Develop, test, and deploy Cloudflare Workers with Deno.

[denoflare.dev](https://denoflare.dev)

## tailweb (tail.denoflare.dev)

View live requests and logs from Cloudflare Workers from the comfort of your browser. [Learn more](./tailweb.md)

## `denoflare` cli

Denoflare cli is a standard Deno program, so it benefits from the permission model and installation flexibility of all Deno programs.

Since Denoflare is still under active development, it's easiest to simply "install" it by defining a shell function in your shell config to a `deno run` command:

```sh
# e.g. bash
function denoflare {
    deno run --unstable --allow-read --allow-net --allow-env https://raw.githubusercontent.com/skymethod/denoflare/v0.1.4/cli/cli.ts "$@"
}
```

You can also try [`deno install`](https://deno.land/manual@v1.13.2/tools/script_installer), and we'll start posting standard releases (via [`deno compile`](https://deno.land/manual@v1.13.2/tools/compiler)) when `denoflare` nears a stable feature set.

Once `denoflare` is defined, the cli includes docs on each command.

```sh
$ denoflare
denoflare 0.1.0

USAGE:
    denoflare [command] [FLAGS] [OPTIONS] [args]

COMMANDS:
    serve       Run a worker script on a local web server
    push        Upload a worker script to Cloudflare Workers
    tail        View a stream of logs from a published worker
    version     Dump cli version

For command-specific help: denoflare [command] --help
```

```sh
$ denoflare serve
denoflare-serve 0.1.0
Run a worker script on a local web server

USAGE:
    denoflare serve [FLAGS] [OPTIONS] [--] [script-spec]

FLAGS:
    -h, --help        Prints help information
        --verbose     Toggle verbose output (when applicable)

OPTIONS:
        --port <number>     Local port to use for the http server (default: 8080)
        --profile <name>    Name of profile to load from config (default: only profile or default profile in config)
        --config <path>     Path to config file (default: .denoflare in cwd or parents)

ARGS:
    <script-spec>    Name of script defined in .denoflare config, file path to bundled js worker, or an https url to a module-based worker .ts, e.g. https://path/to/worker.ts
```

```sh
$ denoflare push
denoflare-push 0.1.0
Upload a worker script to Cloudflare Workers

USAGE:
    denoflare push [FLAGS] [OPTIONS] [--] [script-spec]

FLAGS:
    -h, --help        Prints help information
        --verbose     Toggle verbose output (when applicable)

OPTIONS:
    -n, --name <name>        Name to use for Cloudflare Worker script [default: Name of script defined in .denoflare config, or https url basename sans extension]
        --profile <name>     Name of profile to load from config (default: only profile or default profile in config)
        --config <path>      Path to config file (default: .denoflare in cwd or parents)

ARGS:
    <script-spec>    Name of script defined in .denoflare config, file path to bundled js worker, or an https url to a module-based worker .ts, e.g. https://path/to/worker.ts
```

```sh
$ denoflare tail
denoflare-tail 0.1.0
View a stream of logs from a published worker

USAGE:
    denoflare tail [FLAGS] [OPTIONS] [--] [name]

FLAGS:
    -h, --help        Prints help information
        --once        Stops the tail after receiving the first log (useful for testing)
        --verbose     Toggle verbose output (when applicable)

OPTIONS:
    -f, --format <format>                   Output format for log messages [default: json]  [possible values: json, pretty]
        --header <header>...                Filter by HTTP header
        --ip-address <ip-address>...        Filter by IP address ("self" to filter your own IP address)
        --method <method>...                Filter by HTTP method
        --sampling-rate <sampling-rate>     Adds a sampling rate (0.01 for 1%) [default: 1]
        --search <search>                   Filter by a text match in console.log messages
        --status <status>...                Filter by invocation status [possible values: ok, error, canceled]
        --profile <name>                    Name of profile to load from config (default: only profile or default profile in config)
        --config <path>                     Path to config file (default: .denoflare in cwd or parents)

ARGS:
    <name>    Name of the worker to tail
```
