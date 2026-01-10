/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_PWM_API_BASE: process.env.NEXT_PUBLIC_PWM_API_BASE || 'http://localhost:8011/pwm/api',
  },
}

module.exports = nextConfig
