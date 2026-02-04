export const buildWhatsAppLink = (phone: string, message: string) => {
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encodedMessage}`;
};
