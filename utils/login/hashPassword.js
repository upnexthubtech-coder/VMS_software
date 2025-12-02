const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

async function hashPassword(password) {
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  return hashed;
}

async function verifyPassword(password, hashedPassword) {
  const isValid = await bcrypt.compare(password, hashedPassword);
  return isValid;
}

module.exports = {
  hashPassword,
  verifyPassword
};
