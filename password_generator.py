import secrets
import string


def generate_password():

    while True:

        length = int(input("\nHow many characters? "))

        if length < 8:
            print("\nPassword must be at least 8 characters long.")

        else:
            break


    # Special characters we want to allow
    #special_characters = "!@#$%^&*"


    # Make sure the password has at least
    # one character from each category

    password = [
        secrets.choice(string.ascii_uppercase),   # Uppercase
        secrets.choice(string.ascii_lowercase),   # Lowercase
        secrets.choice(string.digits),            # Digit
        secrets.choice(string.punctuation)        # Special character
    ]


    # Characters available for the remaining positions
    characters = (
        string.ascii_letters
        + string.digits
        + string.punctuation
    )


    # Fill the remaining characters
    for i in range(length - 4):

        password.append(secrets.choice(characters))


    # Shuffle everything so the required characters
    # aren't always in the same position
    # Randomly shuffle the characters
    secrets.SystemRandom().shuffle(password)


    # Convert list into a string
    password = "".join(password)


    return password


if __name__ == "__main__":
    generated = generate_password()
    print("\nGenerated Password:", generated)

