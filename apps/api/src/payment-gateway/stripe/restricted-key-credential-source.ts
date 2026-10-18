import { Injectable } from "@nestjs/common";
import { StripeApiCredentials, StripeCredentialSource } from "./stripe-credential-source.interface";

/** B2 - today's only StripeCredentialSource: the store's own restricted key is the whole credential, no connected account involved. */
@Injectable()
export class RestrictedKeyCredentialSource implements StripeCredentialSource {
  resolve(connection: { apiKey: string; merchantId: string | null }): StripeApiCredentials {
    return { apiKey: connection.apiKey };
  }
}
