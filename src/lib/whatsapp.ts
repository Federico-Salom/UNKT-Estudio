export const buildWhatsAppLink = (phone: string, message: string) => {
  const sanitizedPhone = phone.replace(/[^\d]/g, "");
  const targetPhone = sanitizedPhone || phone.trim();
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${targetPhone}?text=${encodedMessage}`;
};
