// User entity removed from TypeORM mappings. Kept as a plain class to avoid
// breaking TypeScript imports in places that may still reference User.
export class User {
  id?: string;
  username?: string;
  passwordHash?: string;
  role?: string;
  createdAt?: Date;
}
