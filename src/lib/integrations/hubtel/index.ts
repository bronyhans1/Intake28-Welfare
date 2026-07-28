/**
 * Hubtel SMS/OTP integration module.
 * Phase 2: send OTP during account activation, verify OTP responses.
 *
 * Credentials are validated lazily via getHubtelConfig() when SMS is used.
 *
 * @see src/lib/utils/activation-otp.ts
 */
export {
  getHubtelConfig,
  HubtelConfigurationError,
  isHubtelConfigured,
  type HubtelConfig,
} from "@/lib/integrations/hubtel/config";
