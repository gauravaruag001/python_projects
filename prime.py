def is_prime(num):
    if num <= 1:
        return False
    for i in range(2, int(num**0.5) + 1):
        if num % i == 0:
            return False
    return True

def main():
    try:
        n = int(input("How many prime numbers do you want to print? "))
        count = 0
        num = 2
        while count < n:
            if is_prime(num):
                print(num)
                count += 1
            num += 1
    except ValueError:
        print("Please enter a valid integer.")

if __name__ == "__main__":
    main()