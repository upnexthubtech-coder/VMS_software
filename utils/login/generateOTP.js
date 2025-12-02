function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // six digit OTP as string
}

module.exports = generateOTP;
