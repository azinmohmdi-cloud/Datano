import { mkdtemp, mkdir, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

// Keep test pages and their build output outside the product app and route tree.
const frontend = process.cwd();
const apiURL = process.env.DATANO_TRANSPORT_API_URL;
if (!apiURL) throw new Error("Dedicated integration backend URL is required");
const directory = await mkdtemp(path.join(tmpdir(), "datano-fe029-browser-"));
await mkdir(path.join(directory, "app"));
await symlink(path.join(frontend, "node_modules"), path.join(directory, "node_modules"), "dir");
await writeFile(path.join(directory, "package.json"), JSON.stringify({ private: true }));
await writeFile(path.join(directory, "tsconfig.json"), JSON.stringify({ compilerOptions: {
  target: "ES2017", lib: ["dom", "esnext"], jsx: "preserve", module: "esnext", moduleResolution: "bundler",
  esModuleInterop: true, skipLibCheck: true, strict: true, paths: { "@/*": [frontend + "/*"] },
}, include: ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules"] }));
await writeFile(path.join(directory, "next.config.mjs"), `export default {
  experimental: { externalDir: true }, devIndicators: false, skipTrailingSlashRedirect: true,
  webpack(config) { config.resolve.alias['@'] = ${JSON.stringify(frontend)}; return config; },
  async rewrites() { return [{ source: '/api/:path*', destination: ${JSON.stringify(apiURL + "/api/:path*")} }]; }
};\n`);
await writeFile(path.join(directory, "app/layout.tsx"), "export default function Layout({children}: {children: React.ReactNode}) { return <html><body>{children}</body></html>; }\n");
const page = process.env.DATANO_TEST_REGISTRATION === "1" ? "tests/session/registration-page" : "tests/transport/browser-page";
await writeFile(path.join(directory, "app/page.tsx"), `export {default} from ${JSON.stringify(path.join(frontend, page))};\n`);

const child = spawn(process.execPath, [path.join(frontend, "node_modules/next/dist/bin/next"), "dev", directory,
  "--webpack", "--hostname", "127.0.0.1", "--port", "3139"], {
  stdio: "inherit", env: { ...process.env,
    NEXT_PUBLIC_API_URL_V1: process.env.DATANO_TRANSPORT_SAME_ORIGIN === "1" ? "" : apiURL },
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code || 0; });
