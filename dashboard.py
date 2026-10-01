import password_checker as check
import password_generator as generate

def dashboard():

    while True:


        print("\nPASSWORD DASHBOARD\n")
        print("1.Generate Password")
        print("2.Check Password")
        print("3.Exit")

        choice = input("\nEnter your Choice:")

        if choice == "1":

            password = generate.generate_password()
            print("\nGenerated Password :",password)


        elif choice == "2":

            check.check_password()

        elif choice == "3":
            print("\nGoodbye! 👋 ")
            break

        else:
            print("\nInvalid choice. Please try again!!!")


dashboard()