<?php

use App\Course;
use Illuminate\Database\Seeder;

class HelperCourseSeeder extends Seeder
{
    public function run()
    {
        $this->createDummyCredits(20);
        $this->createDummyCredits(75);
        $this->createDummyCredits(120);
        $this->createDummyCredits(130);
    }

    private function createDummyCredits($credits)
    {
        $course = new Course;
        $course->code = '___'.$credits.'___';
        $course->name = $credits.' kredit';
        $course->save();
    }
}
