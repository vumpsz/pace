// S&P 500 total return (price + dividends), nominal, percent per calendar year.
// Source: Aswath Damodaran's annual returns dataset (NYU Stern). 2025 is approximate.
export const HIST_START_YEAR = 1928
export const SP500_TOTAL_RETURNS_PCT = [
  43.81, -8.3, -25.12, -43.84, -8.64, 49.98, -1.19, 46.74, 31.94, -35.34, // 1928-1937
  29.28, -1.1, -10.67, -12.77, 19.17, 25.06, 19.03, 35.82, -8.43, 5.2, // 1938-1947
  5.7, 18.3, 30.81, 23.68, 18.15, -1.21, 52.56, 32.6, 7.44, -10.46, // 1948-1957
  43.72, 12.06, 0.34, 26.64, -8.81, 22.61, 16.42, 12.4, -9.97, 23.8, // 1958-1967
  10.81, -8.24, 3.56, 14.22, 18.76, -14.31, -25.9, 37.0, 23.83, -6.98, // 1968-1977
  6.51, 18.52, 31.74, -4.7, 20.42, 22.34, 6.15, 31.24, 18.49, 5.81, // 1978-1987
  16.54, 31.48, -3.06, 30.23, 7.49, 9.97, 1.33, 37.2, 22.68, 33.1, // 1988-1997
  28.34, 20.89, -9.03, -11.85, -21.97, 28.36, 10.74, 4.83, 15.61, 5.48, // 1998-2007
  -36.55, 25.94, 14.82, 2.1, 15.89, 32.15, 13.52, 1.38, 11.77, 21.61, // 2008-2017
  -4.23, 31.21, 18.02, 28.47, -18.04, 26.06, 24.88, 17.9, // 2018-2025
]

export const HIST_END_YEAR = HIST_START_YEAR + SP500_TOTAL_RETURNS_PCT.length - 1
export const SP500_TOTAL_RETURNS = SP500_TOTAL_RETURNS_PCT.map((p) => p / 100)

export function histStats(returns = SP500_TOTAL_RETURNS) {
  const n = returns.length
  const mean = returns.reduce((a, b) => a + b, 0) / n
  const cagr = Math.exp(returns.reduce((a, b) => a + Math.log(1 + b), 0) / n) - 1
  const sd = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1))
  const worst = Math.min(...returns)
  const negative = returns.filter((r) => r < 0).length
  return { n, mean, cagr, sd, worst, negative }
}
