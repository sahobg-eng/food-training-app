import { ValidationError } from '../db/validation';

/** Message to show the user for a failed action. */
export const errorMessage = (e: unknown) =>
  e instanceof ValidationError ? e.message : 'Something went wrong. Try again.';
