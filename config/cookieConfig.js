const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    sameSite: isProduction ? 'None' : 'Lax',
    secure: isProduction
  };
};

const getClearCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: isProduction ? 'None' : 'Lax',
    secure: isProduction
  };
};

module.exports = {
  getCookieOptions,
  getClearCookieOptions
};
