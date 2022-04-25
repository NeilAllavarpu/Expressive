.global print
print:
  mov  x0, x1
  b    printf
.global return
return:
  mov  x0, x1
  mov  sp, x29
  ldp  x29, x30, [sp], #16
  ret
