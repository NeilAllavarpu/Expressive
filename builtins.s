.global print
.global length
.global read_int
.data
scanf_suffix: .asciz "%d"
.text
print:
  b    #12
  nop
  ldp  x29, x30, [sp], #16
  mov  x0, x1
  mov  x1, x2
  b    printf
length:
  nop
  nop
  ldr  x4, [x1]
  ret
read_int:
  stp  x29, x30, [sp, #-16]!
  mov  x29, sp
  adrp x0, scanf_suffix
  add  x0, x0, #:lo12:scanf_suffix
  sub  sp, sp, #16
  mov  x1, sp
  bl   scanf
  ldr  x4, [sp]
  add  sp, sp, #32
  ldp  x29, x30, [sp, #-16]
  ret
