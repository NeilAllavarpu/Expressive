.global print
print:
  b    #12
  nop
  ldp  x29, x30, [sp], #16
  mov  x0, x1
  mov  x1, x2
  b    printf
