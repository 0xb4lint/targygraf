<?php

namespace App;

use Illuminate\Database\Eloquent\SoftDeletes;

class CourseBlock extends Model
{
    use SoftDeletes;

    protected $table = 'course_blocks';



    public function courses()
    {
        return $this->hasMany(Course::class);
    }
}
