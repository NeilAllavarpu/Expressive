#include <string.h>
#include <stdlib.h>

char *string_add(const char *str1, const char *str2)
{
  size_t strlen1 = strlen(str1);
  size_t size_dest = strlen1 + strlen(str2);
  char *dest = malloc((size_dest + 1) * sizeof(char));

  strcpy(dest, str1);
  strcpy(dest + strlen1, str2);
  dest[size_dest] = '\0';

  return dest;
}
