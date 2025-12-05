export const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const isValidPeruvianPhone = (phone?: string) => {
  if (!phone) return true;
  const trimmed = phone.trim();
  return /^(\+?51)?9\d{8}$/.test(trimmed) || /^\+?[0-9\s-]{6,15}$/.test(trimmed);
};

export const isValidDni = (dni: string) => /^\d{8}$/.test(dni.trim());

export const isValidRuc = (ruc: string) => /^\d{11}$/.test(ruc.trim());

export const isStrongPassword = (password: string) =>
  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_\-+=]{8,64}$/.test(password);
