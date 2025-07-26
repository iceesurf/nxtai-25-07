export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const phoneRegex = /^\+?[\d\s\-\(\)]+$/;

export function isValidEmail(email: string): boolean {
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  return phoneRegex.test(phone);
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function validateLead(lead: Partial<any>): string[] {
  const errors: string[] = [];

  if (!lead.name || lead.name.trim().length < 2) {
    errors.push('Nome deve ter pelo menos 2 caracteres');
  }

  if (lead.email && !isValidEmail(lead.email)) {
    errors.push('Email inválido');
  }

  if (lead.phone && !isValidPhone(lead.phone)) {
    errors.push('Telefone inválido');
  }

  return errors;
}

export function validateUser(user: Partial<any>): string[] {
  const errors: string[] = [];

  if (!user.name || user.name.trim().length < 2) {
    errors.push('Nome deve ter pelo menos 2 caracteres');
  }

  if (!user.email || !isValidEmail(user.email)) {
    errors.push('Email válido é obrigatório');
  }

  if (!user.role || !['admin', 'editor', 'viewer'].includes(user.role)) {
    errors.push('Role inválido');
  }

  return errors;
}