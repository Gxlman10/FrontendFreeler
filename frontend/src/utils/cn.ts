import clsx from 'clsx';

type ClassValue = Parameters<typeof clsx>[number];

export const cn = (...classes: ClassValue[]) => clsx(...classes);
