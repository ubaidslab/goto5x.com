import { Injectable } from "@nestjs/common";
import { request } from "https";
import { ITlsProber } from "./tls-prober.interface";

const PROBE_TIMEOUT_MS = 5000;

/**
 * Real HTTPS handshake against the live internet (verified reachable in
 * this sandbox, unlike Google's OAuth APIs) - `rejectUnauthorized: true`
 * (the default) means an invalid, expired, or self-signed certificate fails
 * the probe exactly like a real buyer's browser would reject it.
 */
@Injectable()
export class NodeTlsProberService implements ITlsProber {
  async probe(hostname: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const req = request(
        { host: hostname, port: 443, path: "/", method: "HEAD", timeout: PROBE_TIMEOUT_MS },
        (res) => {
          res.resume();
          resolve(true);
        },
      );
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
      req.end();
    });
  }
}
