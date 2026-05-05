import http, { type Server } from "node:http";
import { ProxyServer } from "@refactorjs/http-proxy";

export function startProxyServer(): Promise<{
	origin: string;
	server: Server;
}> {
	const proxy = new ProxyServer();

	proxy.on("proxyRes", (proxyRes, req, res) => {
		res.setHeader("Access-Control-Allow-Origin", "*");
		proxyRes.pipe(res);
	});
	const server = http.createServer((req, res) => {
		const targetUrlString = req.url?.replace(/^\//, "") || "";
		let targetUrl: URL;
		try {
			targetUrl = new URL(targetUrlString);
		} catch (error) {
			res.statusCode = 400;
			res.end(`Invalid url "${targetUrlString}"`);
			return;
		}
		req.url = targetUrl.pathname + targetUrl.search;
		proxy.web(req, res, {
			target: targetUrl.origin,
			changeOrigin: true,
			secure: false,
			selfHandleResponse: true,
		});
	});

	process.on("SIGINT", () => {
		server.close();
	});

	return new Promise((resolve, reject) => {
		server.on("error", reject);
		server.on("listening", () => {
			const address = server.address();
			if (address === null) {
				throw Error("Could not create proxy server");
			}
			const formattedAddress =
				typeof address === "object"
					? `http://localhost:${address.port}`
					: address;
			resolve({
				server,
				origin: formattedAddress,
			});
		});

		server.listen();
	});
}
