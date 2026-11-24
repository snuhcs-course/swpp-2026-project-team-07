// The reviewer and self-hosted editions retain their provider-billing disclosures.
const retryMessages = new Set([
  'A previous request may already have been charged. Another request may incur another charge. Continue only if you accept this.',
  'A previous request may have reached the provider. Retrying may incur another charge.',
  'The previous transcription request may already have been charged. Retrying may send the audio again and incur another charge. There is no guarantee of exactly one provider request.',
  'The previous request may have reached the provider and incurred a charge. Retry the same saved input?',
  'The previous provider request has an uncertain outcome. Retrying may incur another charge.',
  'The previous request has an uncertain outcome. Retrying may incur another charge.',
  'The previous transcription may have been charged. Confirm before retrying.',
  'The previous profile request may have been charged. Confirm before retrying.',
  'The previous answer evaluation may have been charged. Confirm before retrying.',
  'The previous request may have been charged. Retrying it may incur another charge.',
  'Request outcome is unconfirmed. Refresh before another submission; another request may incur another charge.',
]);
export function storeWording(text: string) {
  if (text === 'Retry may charge again') return 'Retry online processing?';
  if (retryMessages.has(text)) return 'The previous request may have reached the provider. Retrying sends the same input again. OutLoud covers the cost.';
  if (text.startsWith('Your saved answer audio and vocabulary hints') || text.startsWith('AI suggestions send slide images and text'))
    return text.replace('Requests may incur provider charges.', 'OutLoud covers the cost.');
  return text;
}
