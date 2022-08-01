export const range = ({ from = 0, to = 0, step = 1, length = Math.ceil((to - from) / step) }) =>
    Array.from({ length }, (_, i) => from + i * step);