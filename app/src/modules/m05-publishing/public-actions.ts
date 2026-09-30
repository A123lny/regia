// M05 Publishing — barrel client-safe per server actions (RS-1).
// Riesporta solo le action da actions.ts (che ha "use server").
// NON importa adapter-registry né twilio, quindi sicuro per il browser bundle.

export {
  updateChannelCredentialsAction,
  setChannelEnabledAction,
  testChannelAction,
  listChannelsAction,
} from "./internal/actions";
