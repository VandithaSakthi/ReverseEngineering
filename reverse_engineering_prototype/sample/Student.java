package sample;

public class Student extends Person {
    private String rollNumber;
    private Course course;

    public Student(String name, int age, String rollNumber) {
        super(name, age);
        this.rollNumber = rollNumber;
    }

    public void registerCourse(Course course) {
        this.course = course;
    }

    public String getRollNumber() {
        return rollNumber;
    }
}
