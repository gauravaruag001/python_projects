import matplotlib.pyplot as plt
import random

for i in range(2):
    for j in range(2):
        x = random.randint(0,10)
        y = random.randint(0,10)
        print(f"({x},{y})")
        plt.plot(x,y,'o')


plt.xlabel("Age")
plt.ylabel("Experience")
plt.show()