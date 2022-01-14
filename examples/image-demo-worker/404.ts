export function compute404() {
    const title = 'Not found';
    const body = `
<body class="bg-slate-900 text-slate-500 text-center">
    <div class="container mx-auto">
        <h3 class="mt-5">Not found</h3>
    </div>
</body>`;
    return { title, body };
}
