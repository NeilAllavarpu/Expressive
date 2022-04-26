.global print
print:
  nop
  nop
  ldp  x29, x30, [sp], #16
  mov  x0, x1
  b    printf
