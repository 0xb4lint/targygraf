<?php

use App\Course;
use App\Program;
use App\Faculty;
use App\University;
use App\CourseBlock;

class ProgramSeeder extends AbstractJsonFileSeeder
{
    protected $prerequisites;
    protected $courseBlockReferences;
    protected $jsonFilesDirectory = 'seeds/data/programs';



    protected function processData($path, stdClass $data)
    {
        $this->prerequisites = [];
        $this->courseBlockReferences = [];

        $fileNameParts  = explode('_', pathinfo($path, PATHINFO_FILENAME));
        $university     = University::where('slug', $fileNameParts[0])->firstOrFail();
        $faculty        = $university->faculties()->where('slug', $fileNameParts[1])->firstOrFail();

        $program = new Program;
        $program->faculty_id            = $faculty->id;
        $program->slug                  = $fileNameParts[2];
        $program->name                  = $data->name;
        $program->description           = $data->description;
        $program->curriculum_updated_at = $data->curriculum_updated_at;
        $program->save();

        $this->processCourseBlocks($program, $data->course_blocks);
        $this->processPrerequisites($program);
        $this->processCourseBlockReferences($program);
    }



    protected function processCourseBlocks(Program $program, array $courseBlocks)
    {
        $ordering = 0;
        $lastCourseBlockWasSemester = true;

        foreach ($courseBlocks as $rawCourseBlock) {
            if ($lastCourseBlockWasSemester && !$rawCourseBlock->is_semester) {
                $ordering = 0;
            }

            $courseBlock = new CourseBlock;
            $courseBlock->program_id    = $program->id;
            $courseBlock->name          = $rawCourseBlock->name;
            $courseBlock->is_semester   = $rawCourseBlock->is_semester;
            $courseBlock->ordering      = $ordering++;
            $courseBlock->is_counted    = (@$rawCourseBlock->is_counted !== false);
            $courseBlock->save();

            $this->processCourses($courseBlock, $rawCourseBlock->courses);

            $lastCourseBlockWasSemester = $courseBlock->is_semester;
        }
    }



    protected function processCourses(CourseBlock $courseBlock, array $courses)
    {
        foreach ($courses as $i => $rawCourse) {
            $course = new Course;
            $course->course_block_id    = $courseBlock->id;
            $course->code               = $rawCourse->code;
            $course->name               = $rawCourse->name;
            $course->ordering           = $i;
            $course->credits            = $rawCourse->credits;
            $course->save();

            if ($prerequisites = @$rawCourse->prerequisites) {
                $this->prerequisites[ $course->id ] = $prerequisites;
            }

            if ($courseBlockReferences = @$rawCourse->course_block_references) {
                $this->courseBlockReferences[ $course->id ] = $courseBlockReferences;
            }
        }
    }



    protected function processPrerequisites(Program $program)
    {
        foreach ($this->prerequisites as $courseID => $rawPrerequisities) {
            $course = Course::findOrFail($courseID);

            foreach ($rawPrerequisities as $rawPrerequisity) {
                $code           = trim($rawPrerequisity, '()');
                $prerequisity   = Course::where('code', $code)->firstOrFail();

                $course->prerequisites()->attach($prerequisity->id, [
                    'is_parallel' => preg_match('/^\(.+\)$/', $rawPrerequisity)
                ]);
            }
        }
    }



    protected function processCourseBlockReferences(Program $program)
    {
        foreach ($this->courseBlockReferences as $courseID => $rawCourseBlockReferences) {
            $course = Course::findOrFail($courseID);

            foreach ($rawCourseBlockReferences as $rawCourseBlockReference) {
                $courseBlock = $program->courseBlocks()
                    ->where('name', $rawCourseBlockReference)
                    ->firstOrFail();

                $course->courseBlockReferences()->attach($courseBlock->id);
            }
        }
    }
}
